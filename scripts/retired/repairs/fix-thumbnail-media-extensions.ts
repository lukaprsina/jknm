/**
 * One-off backfill for thumbnail `media` rows saved with a wrong file
 * extension/content-type. Root cause (fixed in `src/app/api/media/route.ts`):
 * both thumbnail-upload call sites hardcoded a synthetic filename
 * (`thumbnail.png` / `thumbnail-uploaded.png`) that the upload route used to
 * *guess* the mime type from, instead of trusting the real fetched/uploaded
 * bytes — so a jpg or webp source could end up stored as `original.png` with
 * a lying `image/png` content-type, without ever actually being converted.
 *
 * Candidates are every media row currently in use as a thumbnail
 * (`articles.thumbnail_media_id`), not a guess at which filenames the bug
 * produced — each is re-checked against its real bytes, so this is exact
 * regardless of how a mismatch happened to occur.
 *
 * Media rows are immutable-by-convention (see `MEDIA_PUBLIC_DOMAIN` comment
 * in `src/lib/media-upload.ts`), so a mismatch is fixed by re-uploading under
 * a fresh id with the correct extension, re-pointing the referencing
 * `articles.thumbnail_media_id` at the new row, and only then deleting the
 * old row/object — never by mutating an existing media row's key in place.
 *
 * Deliberately scoped to thumbnails, not all media: content-block images'
 * urls are also embedded literally in `content_json` (see
 * `reconcile_media_to_articles`), so renaming one would need a content
 * rewrite too — out of scope here. A thumbnail can, however, be an *existing*
 * content-block image reused as-is (see `image-selector.tsx`), in which case
 * its media row still has that literal-URL dependency via `media_to_articles`
 * — `fix_one` checks for and preserves that row/object instead of deleting it.
 *
 * Usage:
 *   bun run scripts/fix-thumbnail-media-extensions.ts            # dry run
 *   bun run scripts/fix-thumbnail-media-extensions.ts --execute  # apply
 */

import { parseArgs } from "node:util";
import B2 from "b2-js";
import { eq, inArray, isNotNull } from "drizzle-orm";
import mime from "mime/lite";
import sharp from "sharp";
import { env } from "~/env";
import { media_url } from "~/lib/media-upload";
import { delete_objects } from "~/lib/s3-utils";
import { db } from "~/server/db";
import { Article, Media, MediaToArticles } from "~/server/db/schema";

async function find_candidate_media() {
	// Scoped to media actually in use as a thumbnail (`articles.thumbnail_media_id`)
	// rather than a guess about which filenames the bug produced — thumbnails
	// are the only media rows safe to rename unconditionally, since (unlike
	// content-block images) their url is never embedded literally elsewhere
	// (no `content_json`/`media_to_articles` dependency to rewrite).
	const thumbnail_ids = await db
		.selectDistinct({ id: Article.thumbnail_media_id })
		.from(Article)
		.where(isNotNull(Article.thumbnail_media_id));
	const ids = thumbnail_ids.map((row) => row.id).filter((id) => id !== null);
	if (ids.length === 0) return [];

	return db.query.Media.findMany({
		where: inArray(Media.id, ids),
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

	// A thumbnail can be an existing content-block image reused as-is (see
	// image-selector.tsx), in which case the old media row is also linked via
	// `media_to_articles` (derived from a literal URL in some article's
	// `content_json`, per reconcile-media.ts). That row/object must survive —
	// deleting it would cascade-delete the link and break the inline image,
	// with no way to recover once the B2 object is gone.
	const still_embedded = await db.transaction(async (tx) => {
		await tx.insert(Media).values({
			id: new_id,
			filename: media.filename.replace(/\.[^./]+$/, `.${extension}`),
			content_type,
			size_bytes: buffer.byteLength,
			original: { url, width, height, size_bytes: buffer.byteLength },
			variants: [],
			srcsets: null,
		});

		await tx
			.update(Article)
			.set({ thumbnail_media_id: new_id })
			.where(eq(Article.thumbnail_media_id, media.id));

		const [embed] = await tx
			.select({ media_id: MediaToArticles.media_id })
			.from(MediaToArticles)
			.where(eq(MediaToArticles.media_id, media.id))
			.limit(1);
		if (embed) return true;

		await tx.delete(Media).where(eq(Media.id, media.id));
		return false;
	});

	if (still_embedded) {
		console.log(
			`Fixed ${media.id} -> ${new_id} (${key}); old row kept, still embedded in article content`,
		);
		return;
	}

	const old_key = new URL(media.original.url).pathname.replace(/^\//, "");
	await delete_objects(env.NEXT_PUBLIC_AWS_MEDIA_BUCKET_NAME, [old_key]);

	console.log(`Fixed ${media.id} -> ${new_id} (${key})`);
}

async function main() {
	const { values } = parseArgs({ options: { execute: { type: "boolean" } } });
	const execute = values.execute ?? false;

	const candidates = await find_candidate_media();
	console.log(`${candidates.length} thumbnail media row(s) to check.`);

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
