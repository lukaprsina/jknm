/**
 * One-time optimization pass for the static-page image content in the
 * `jknm-vsebina` bucket (served at `vsebina.jknm.org`). These images are
 * hand-written into `src/app/(static)/*.mdx` and never churn, so unlike
 * article media they don't need a database table — this script generates an
 * AVIF sibling next to each original (`foo.jpg` -> `foo.avif`) and records
 * which paths got one in `artifacts/image_sizes.json`, the existing static
 * sidecar manifest already used for width/height. `ImageWithCaption` then
 * serves the AVIF via a `<picture>` source, falling back to the original for
 * any path without one.
 *
 * Vercel's built-in image optimization is deliberately unused here (see
 * `next.config.mjs`'s `images.unoptimized`) since it bills per-transform —
 * this script is the manual substitute, run once (or re-run to backfill any
 * newly added static images; already-optimized paths are skipped).
 *
 * Usage:
 *   bun run scripts/optimize-static-content-images.ts            # dry run
 *   bun run scripts/optimize-static-content-images.ts --execute  # apply
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import B2 from "b2-js";
import sharp from "sharp";
import { env } from "~/env";
import { list_objects } from "~/lib/s3-utils";

const CONTENT_BUCKET = env.NEXT_PUBLIC_AWS_CONTENT_BUCKET_NAME;
const CONTENT_DOMAIN = "vsebina.jknm.org";
const CACHE_DIR = path.join(import.meta.dirname, ".cache", "vsebina");
const IMAGE_SIZES_PATH = path.join(
	import.meta.dirname,
	"..",
	"artifacts",
	"image_sizes.json",
);
// Originals are already downscaled to <=1500px on the long edge (see
// artifacts/image_sizes.json), so this cap is a no-op for almost everything —
// it just guards against a future oversized upload.
const MAX_WIDTH = 1600;
const AVIF_QUALITY = 60;
// Skip keeping an AVIF that doesn't meaningfully beat the original (small
// graphics like the two logo png/gif files can re-encode larger).
const MIN_SAVINGS_RATIO = 0.9;

interface ImageSizeEntry {
	path: string;
	size: { width: number; height: number };
	has_avif?: boolean;
}

async function load_image_sizes(): Promise<ImageSizeEntry[]> {
	const raw = await readFile(IMAGE_SIZES_PATH, "utf-8");
	return JSON.parse(raw) as ImageSizeEntry[];
}

async function download_original(key: string): Promise<Buffer> {
	const cache_path = path.join(CACHE_DIR, key);
	try {
		return await readFile(cache_path);
	} catch {
		// not cached yet
	}

	const response = await fetch(`https://${CONTENT_DOMAIN}/${key}`);
	if (!response.ok) {
		throw new Error(`Failed to download ${key}: ${response.status}`);
	}
	const buffer = Buffer.from(await response.arrayBuffer());

	await mkdir(path.dirname(cache_path), { recursive: true });
	await writeFile(cache_path, buffer);

	return buffer;
}

function avif_key(key: string) {
	return key.replace(/\.[^./]+$/, ".avif");
}

async function process_one(
	b2: Awaited<ReturnType<typeof B2.authorize>>,
	existing_keys: Set<string>,
	key: string,
	execute: boolean,
) {
	const target_key = avif_key(key);
	if (existing_keys.has(target_key)) {
		console.log(`SKIP (already has avif): ${key}`);
		return true;
	}

	const original = await download_original(key);
	const avif_buffer = await sharp(original)
		.rotate()
		.resize({ width: MAX_WIDTH, withoutEnlargement: true })
		.avif({ quality: AVIF_QUALITY })
		.toBuffer();

	if (avif_buffer.byteLength >= original.byteLength * MIN_SAVINGS_RATIO) {
		console.log(
			`SKIP (no meaningful savings): ${key} (${original.byteLength} -> ${avif_buffer.byteLength} bytes)`,
		);
		return false;
	}

	console.log(
		`AVIF ${key} -> ${target_key} (${original.byteLength} -> ${avif_buffer.byteLength} bytes, ${Math.round((1 - avif_buffer.byteLength / original.byteLength) * 100)}% smaller)`,
	);

	if (!execute) return true;

	const bucket_obj = await b2.bucket(CONTENT_BUCKET);
	await bucket_obj.upload(target_key, avif_buffer, {
		contentType: "image/avif",
		contentLength: avif_buffer.byteLength,
	});

	return true;
}

async function main() {
	const { values } = parseArgs({ options: { execute: { type: "boolean" } } });
	const execute = values.execute ?? false;

	const objects = await list_objects(CONTENT_BUCKET, "");
	if (!objects) throw new Error(`Could not list bucket ${CONTENT_BUCKET}`);

	const all_keys = objects
		.map((object) => object.Key)
		.filter((key): key is string => typeof key === "string");
	const existing_keys = new Set(all_keys);
	const source_keys = all_keys.filter((key) => !key.endsWith(".avif"));

	console.log(
		`${source_keys.length} source image(s) in ${CONTENT_BUCKET} (${all_keys.length} total objects).`,
	);

	const b2 = await B2.authorize({
		applicationKeyId: env.AWS_ACCESS_KEY_ID,
		applicationKey: env.AWS_SECRET_ACCESS_KEY,
	});

	const image_sizes = await load_image_sizes();
	const by_path = new Map(image_sizes.map((entry) => [entry.path, entry]));

	for (const key of source_keys) {
		try {
			const has_avif = await process_one(b2, existing_keys, key, execute);
			const entry = by_path.get(key);
			if (entry && execute) entry.has_avif = has_avif;
		} catch (error) {
			console.error(`Failed on ${key}`, error);
		}
	}

	if (execute) {
		await writeFile(IMAGE_SIZES_PATH, `${JSON.stringify(image_sizes, null, "\t")}\n`);
		console.log(`Updated ${IMAGE_SIZES_PATH}`);
	} else {
		console.log("Dry run only — re-run with --execute to apply.");
	}
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
