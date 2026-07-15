import B2 from "b2-js";
import mime from "mime/lite";
import sharp from "sharp";
import { env } from "~/env";
import { extract_media_refs_from_content } from "~/lib/editor-utils";
import { media_url } from "~/lib/media-upload";
import type { DbTransaction } from "~/server/db";
import type { ThumbnailType } from "~/lib/validators";
import type { ArticleContentType } from "~/server/db/schema";
import { Media } from "~/server/db/schema";

/**
 * Collects the distinct legacy media urls referenced by a legacy article's
 * content(s) and thumbnail crop, across the published row and its
 * in-progress draft (if any) — so a thumbnail reused in the body only gets
 * migrated once.
 */
export function collect_legacy_media_urls(
	contents: (ArticleContentType | null | undefined)[],
	thumbnail_crops: (ThumbnailType | null | undefined)[],
) {
	const urls = new Set<string>();

	for (const content of contents) {
		if (!content) continue;
		for (const ref of extract_media_refs_from_content(content)) {
			if (ref.data.file.url) urls.add(ref.data.file.url);
		}
	}

	for (const crop of thumbnail_crops) {
		if (crop?.image_url) urls.add(crop.image_url);
	}

	return [...urls];
}

/**
 * Fetches a legacy media url, uploads it into the new `jknm-gradivo` bucket
 * under a fresh uuid (original only — variant/srcset generation is left to
 * the not-yet-built async pipeline per #22), and inserts the `media` row.
 * Returns null (logging a warning) rather than throwing on a single
 * unreachable url, so one broken legacy image doesn't fail the whole
 * article's migration.
 */
export async function migrate_one_media_object(
	tx: DbTransaction,
	b2: Awaited<ReturnType<typeof B2.authorize>>,
	old_url: string,
) {
	const response = await fetch(old_url);
	if (!response.ok) {
		console.warn(`Failed to fetch legacy media ${old_url}: ${response.status}`);
		return null;
	}

	const array_buffer = await response.arrayBuffer();
	const buffer = Buffer.from(array_buffer);

	const content_type =
		response.headers.get("content-type") ?? "application/octet-stream";
	const extension = mime.getExtension(content_type) ?? "bin";
	const filename = old_url.split("/").pop() ?? `media.${extension}`;

	const id = crypto.randomUUID();
	const key = `${id}/original.${extension}`;

	const bucket_obj = await b2.bucket(env.NEXT_PUBLIC_AWS_MEDIA_BUCKET_NAME);
	await bucket_obj.upload(key, buffer, {
		contentType: content_type,
		contentLength: buffer.byteLength,
	});

	const url = media_url(key);
	let width = 0;
	let height = 0;
	if (content_type.startsWith("image/")) {
		const metadata = await sharp(buffer).metadata();
		width = metadata.width ?? 0;
		height = metadata.height ?? 0;
	}

	const [inserted] = await tx
		.insert(Media)
		.values({
			id,
			filename,
			content_type,
			size_bytes: buffer.byteLength,
			original: { url, width, height, size_bytes: buffer.byteLength },
			variants: [],
			srcsets: null,
			upload_status: "pending",
		})
		.returning();

	return inserted ?? null;
}

/**
 * Migrates every distinct legacy media url into the new `media` table,
 * returning an old-url -> new-media-row map for content rewriting and
 * thumbnail resolution.
 */
export async function migrate_legacy_media(
	tx: DbTransaction,
	old_urls: string[],
) {
	const url_to_media = new Map<string, typeof Media.$inferSelect>();
	if (old_urls.length === 0) return url_to_media;

	const b2 = await B2.authorize({
		applicationKeyId: env.AWS_ACCESS_KEY_ID,
		applicationKey: env.AWS_SECRET_ACCESS_KEY,
	});

	for (const old_url of old_urls) {
		const media = await migrate_one_media_object(tx, b2, old_url);
		if (media) url_to_media.set(old_url, media);
	}

	return url_to_media;
}
