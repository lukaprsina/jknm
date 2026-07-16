/**
 * One-off backfill for thumbnail `media` rows saved with a wrong file
 * extension/content-type. Root cause (fixed in `src/app/api/media/route.ts`):
 * both thumbnail-upload call sites hardcoded a synthetic filename
 * (`thumbnail.png` / `thumbnail-uploaded.png`) that the upload route used to
 * *guess* the mime type from, instead of trusting the real fetched/uploaded
 * bytes — so a jpg or webp source could end up stored as `original.png` with
 * a lying `image/png` content-type, without ever actually being converted.
 *
 * Media rows are immutable-by-convention (see `MEDIA_PUBLIC_DOMAIN` comment
 * in `src/lib/media-upload.ts`), so a mismatch is fixed by re-uploading under
 * a fresh id with the correct extension, re-pointing every referencing
 * `articles.thumbnail_media_id` at the new row, and only then deleting the
 * old row/object — never by mutating an existing media row's key in place.
 *
 * Thumbnails are only ever referenced via `articles.thumbnail_media_id` (no
 * literal URLs are embedded elsewhere for them, unlike content-block images),
 * so this re-pointing is safe and complete.
 *
 * Usage:
 *   bun run scripts/fix-thumbnail-media-extensions.ts            # dry run
 *   bun run scripts/fix-thumbnail-media-extensions.ts --execute  # apply
 */

import { parseArgs } from "node:util";
import B2 from "b2-js";
import { eq, inArray } from "drizzle-orm";
import mime from "mime/lite";
import sharp from "sharp";
import { env } from "~/env";
import { media_url } from "~/lib/media-upload";
import { delete_objects } from "~/lib/s3-utils";
import { db } from "~/server/db";
import { Article, Media } from "~/server/db/schema";

const HARDCODED_THUMBNAIL_FILENAMES = [
	"thumbnail.png",
	"thumbnail-uploaded.png",
];

async function find_candidate_media() {
	return db.query.Media.findMany({
		where: inArray(Media.filename, HARDCODED_THUMBNAIL_FILENAMES),
	});
}

async function sniff_real_content_type(url: string) {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch media ${url}: ${response.status}`);
	}
	const buffer = Buffer.from(await response.arrayBuffer());
	const metadata = await sharp(buffer).metadata();
	if (!metadata.format)
		throw new Error(`Could not detect image format for ${url}`);
	const content_type =
		mime.getType(metadata.format) ?? `image/${metadata.format}`;
	return {
		buffer,
		content_type,
		width: metadata.width ?? 0,
		height: metadata.height ?? 0,
	};
}

async function fix_one(
	b2: Awaited<ReturnType<typeof B2.authorize>>,
	media: typeof Media.$inferSelect,
	execute: boolean,
) {
	const { buffer, content_type, width, height } = await sniff_real_content_type(
		media.original.url,
	);

	if (content_type === media.content_type) {
		console.log(
			`OK, already correct (${content_type}): ${media.id} ${media.original.url}`,
		);
		return;
	}

	const extension = mime.getExtension(content_type) ?? "bin";
	console.log(
		`MISMATCH ${media.id}: stored ${media.content_type} (${media.original.url}) -> real ${content_type} (.${extension})`,
	);

	if (!execute) return;

	const new_id = crypto.randomUUID();
	const key = `${new_id}/original.${extension}`;
	const bucket_obj = await b2.bucket(env.NEXT_PUBLIC_AWS_MEDIA_BUCKET_NAME);
	await bucket_obj.upload(key, buffer, {
		contentType: content_type,
		contentLength: buffer.byteLength,
	});
	const url = media_url(key);

	await db.transaction(async (tx) => {
		await tx.insert(Media).values({
			id: new_id,
			filename: media.filename.replace(/\.[^./]+$/, `.${extension}`),
			content_type,
			size_bytes: buffer.byteLength,
			original: { url, width, height, size_bytes: buffer.byteLength },
			variants: [],
			srcsets: null,
			upload_status: "completed",
		});

		await tx
			.update(Article)
			.set({ thumbnail_media_id: new_id })
			.where(eq(Article.thumbnail_media_id, media.id));

		await tx.delete(Media).where(eq(Media.id, media.id));
	});

	const old_key = new URL(media.original.url).pathname.replace(/^\//, "");
	await delete_objects(env.NEXT_PUBLIC_AWS_MEDIA_BUCKET_NAME, [old_key]);

	console.log(`Fixed ${media.id} -> ${new_id} (${key})`);
}

async function main() {
	const { values } = parseArgs({ options: { execute: { type: "boolean" } } });
	const execute = values.execute ?? false;

	const candidates = await find_candidate_media();
	console.log(
		`${candidates.length} candidate thumbnail media row(s) to check.`,
	);

	const b2 = await B2.authorize({
		applicationKeyId: env.AWS_ACCESS_KEY_ID,
		applicationKey: env.AWS_SECRET_ACCESS_KEY,
	});

	for (const media of candidates) {
		try {
			await fix_one(b2, media, execute);
		} catch (error) {
			console.error(
				`Failed on media ${media.id} (${media.original.url})`,
				error,
			);
		}
	}

	if (!execute) {
		console.log("Dry run only — re-run with --execute to apply fixes.");
	}
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
