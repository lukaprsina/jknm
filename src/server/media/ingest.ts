import B2 from "b2-js";
import mime from "mime/lite";
import sharp from "sharp";
import { env } from "~/env";
import { convert_filename_to_url } from "~/lib/article-utils";
import { media_url } from "~/lib/media-upload";
import type { DbTransaction } from "~/server/db";
import { db } from "~/server/db";
import type { MediaSrcsetsData, MediaVariantData } from "~/server/db/schema";
import { Media } from "~/server/db/schema";

/**
 * The one way bytes become a `media` row.
 *
 * Everything a caller needs to know is `ingest_media(bytes, filename,
 * content_type)`; everything about *how* media is stored — the uuid key
 * layout, which bucket, sniffing the real format, which widths and formats
 * get pre-rendered, how srcsets are strung together, the blur placeholder —
 * lives in here and nowhere else.
 *
 * This used to live inside `POST /api/media`, unexported and behind a
 * `getServerAuthSession()` gate, which meant no script could reach it.
 * `scripts/migrate-legacy-media.ts` consequently grew a *degraded* copy that
 * uploaded the original only and left rows at `upload_status: "pending"` with
 * no variants forever. That duplication is what this module exists to remove:
 * the HTTP route and the migration scripts are now two adapters over one
 * implementation, so an image imported by a script is indistinguishable from
 * one uploaded through the editor.
 */

const VARIANT_WIDTHS = [400, 800, 1600];
const VARIANT_FORMATS = ["avif", "jpeg"] as const;
const BLUR_WIDTH = 16;

type Bucket = Awaited<ReturnType<B2["bucket"]>>;
type B2Client = Awaited<ReturnType<typeof B2.authorize>>;

export interface IngestMediaInput {
	bytes: Buffer;
	/**
	 * Display name. Slugified, and its extension is corrected to match what
	 * the bytes actually are — callers routinely pass a wrong or synthetic one
	 * (the thumbnail crop path hardcodes "thumbnail.png").
	 */
	filename: string;
	/**
	 * The caller's best guess: a form field's `File.type`, or an HTTP
	 * `Content-Type`. Only a starting point — see `sniff_content_type`.
	 */
	content_type: string;
}

export interface IngestMediaDeps {
	/** Defaults to the module-level `db`. Pass a tx to ingest atomically. */
	tx?: DbTransaction | typeof db;
	/** Pass a pre-authorized client to avoid re-authorizing per file in a batch. */
	b2?: B2Client;
}

/**
 * Resolve what the bytes really are, preferring the image decoder over the
 * caller's claim.
 *
 * Neither source is trustworthy on its own: the old site's bucket serves
 * images with a mismatched `Content-Type`, and browsers send `File.type` from
 * the file extension, which the legacy uploads got wrong often enough that a
 * one-off repair script (`fix-thumbnail-media-extensions.ts`) had to exist.
 * sharp reads the actual container, so for anything it recognizes as an image
 * its verdict wins; for non-images (PDFs) there's nothing to decode and the
 * claim stands.
 */
async function sniff_content_type(bytes: Buffer, claimed: string) {
	const metadata = await sharp(bytes)
		.metadata()
		.catch(() => undefined);

	if (!metadata?.format) {
		return { content_type: claimed, width: 0, height: 0, is_image: false };
	}

	return {
		content_type: mime.getType(metadata.format) ?? `image/${metadata.format}`,
		width: metadata.width ?? 0,
		height: metadata.height ?? 0,
		is_image: true,
	};
}

async function generate_image_variants({
	bytes,
	original_width,
	id,
	get_bucket,
}: {
	bytes: Buffer;
	original_width: number;
	id: string;
	get_bucket: () => Promise<Bucket>;
}) {
	// Upscaling would cost bytes and gain nothing, so only widths the original
	// can actually satisfy get rendered — which is why a small original
	// legitimately ends up with no variants and a null srcset.
	const widths = VARIANT_WIDTHS.filter((width) => width < original_width);

	const variants: MediaVariantData[] = [];
	for (const width of widths) {
		for (const format of VARIANT_FORMATS) {
			const resized = sharp(bytes).resize({ width });
			const output_buffer = await (format === "avif"
				? resized.avif({ quality: 50 })
				: resized.jpeg({ quality: 75 })
			).toBuffer();
			const output_metadata = await sharp(output_buffer).metadata();

			const key = `${id}/${width}.${format}`;
			await upload_with_retry(
				get_bucket,
				key,
				output_buffer,
				`image/${format}`,
			);

			variants.push({
				format,
				width,
				height: output_metadata.height ?? 0,
				url: media_url(key),
				size_bytes: output_buffer.byteLength,
			});
		}
	}

	const srcsets: MediaSrcsetsData | null =
		variants.length > 0
			? {
					avif: variants
						.filter((v) => v.format === "avif")
						.map((v) => `${v.url} ${v.width}w`)
						.join(", "),
					jpeg: variants
						.filter((v) => v.format === "jpeg")
						.map((v) => `${v.url} ${v.width}w`)
						.join(", "),
					sizes: "(max-width: 800px) 100vw, 800px",
				}
			: null;

	const blur_buffer = await sharp(bytes)
		.resize({ width: BLUR_WIDTH })
		.jpeg({ quality: 40 })
		.toBuffer();

	return {
		variants,
		srcsets,
		blur_placeholder: `data:image/jpeg;base64,${blur_buffer.toString("base64")}`,
	};
}

/**
 * Upload with retries, re-acquiring the bucket handle each attempt.
 *
 * B2 answers a share of requests with a 500 and tells clients to retry against
 * a *fresh* upload url — the one cached inside the bucket handle is exactly
 * what goes stale, so retrying the same handle would keep failing. `b2-js`
 * surfaces the 500 and does nothing about it, which is enough to abort a batch
 * of hundreds partway through.
 *
 * Backoff is exponential from 1s. Failures still throw after the last attempt:
 * a half-uploaded media object (original stored, variants missing) must not
 * become a `completed` row.
 */
async function upload_with_retry(
	get_bucket: () => Promise<Bucket>,
	key: string,
	bytes: Buffer,
	content_type: string,
	attempts = 4,
) {
	for (let attempt = 1; ; attempt++) {
		try {
			const bucket_obj = await get_bucket();
			return await bucket_obj.upload(key, bytes, {
				contentType: content_type,
				contentLength: bytes.byteLength,
			});
		} catch (error) {
			if (attempt >= attempts) throw error;
			const delay_ms = 1000 * 2 ** (attempt - 1);
			console.warn(
				`  upload of ${key} failed (attempt ${attempt}/${attempts}), retrying in ${delay_ms}ms`,
			);
			await new Promise((resolve) => setTimeout(resolve, delay_ms));
		}
	}
}

/** Authorize once; callers ingesting many files should hoist this themselves. */
export function authorize_b2() {
	return B2.authorize({
		applicationKeyId: env.AWS_ACCESS_KEY_ID,
		applicationKey: env.AWS_SECRET_ACCESS_KEY,
	});
}

/**
 * Store `bytes` and return the resulting `media` row.
 *
 * Images get their full derivative set (avif+jpeg at 400/800/1600, srcsets,
 * blur placeholder); anything else is stored as-is. Either way the row comes
 * back `completed` — there is no async pipeline to finish the job later, so a
 * row this function returns is final. The public url is `media.original.url`.
 *
 * Not idempotent: every call mints a fresh uuid and uploads again. Callers
 * that might see the same source twice (migration scripts re-running) must
 * dedupe before calling, which is why the batch helpers below key on the
 * source url.
 */
export async function ingest_media(
	input: IngestMediaInput,
	deps: IngestMediaDeps = {},
) {
	const database = deps.tx ?? db;
	const b2 = deps.b2 ?? (await authorize_b2());
	const get_bucket = () => b2.bucket(env.NEXT_PUBLIC_AWS_MEDIA_BUCKET_NAME);

	const sniffed = await sniff_content_type(input.bytes, input.content_type);
	const content_type = sniffed.content_type;
	const extension = mime.getExtension(content_type) ?? "bin";

	const id = crypto.randomUUID();
	const key = `${id}/original.${extension}`;

	await upload_with_retry(get_bucket, key, input.bytes, content_type);

	const url = media_url(key);

	const derived =
		sniffed.is_image && sniffed.width > 0
			? await generate_image_variants({
					bytes: input.bytes,
					original_width: sniffed.width,
					id,
					get_bucket,
				})
			: { variants: [], srcsets: null, blur_placeholder: null };

	const base_name = input.filename.replace(/\.[^./]+$/, "");
	const filename = convert_filename_to_url(`${base_name}.${extension}`);

	const [inserted] = await database
		.insert(Media)
		.values({
			id,
			filename,
			content_type,
			size_bytes: input.bytes.byteLength,
			original: {
				url,
				width: sniffed.width,
				height: sniffed.height,
				size_bytes: input.bytes.byteLength,
			},
			variants: derived.variants,
			srcsets: derived.srcsets,
			blur_placeholder: derived.blur_placeholder,
			upload_status: "completed",
		})
		.returning();

	if (!inserted) throw new Error(`Failed to insert media row for ${filename}`);
	return inserted;
}

/**
 * Fetch a url and ingest it. Returns null (with a warning) instead of throwing
 * when the source is unreachable, so one dead legacy url doesn't abort a batch
 * of hundreds — the caller reports the misses and decides what to do.
 */
export async function ingest_media_from_url(
	source_url: string,
	deps: IngestMediaDeps = {},
) {
	const response = await fetch(source_url);
	if (!response.ok) {
		console.warn(`  fetch failed ${response.status}: ${source_url}`);
		return null;
	}

	return ingest_media(
		{
			bytes: Buffer.from(await response.arrayBuffer()),
			filename: decodeURIComponent(source_url.split("/").pop() ?? "media"),
			content_type:
				response.headers.get("content-type") ?? "application/octet-stream",
		},
		deps,
	);
}
