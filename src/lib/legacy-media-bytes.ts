import fs from "node:fs/promises";
import path from "node:path";
import mime from "mime/lite";

/**
 * Served-mirror-first, live-fetch-fallback byte resolution for legacy
 * *images* — the same pattern `resolve_pdf_bytes` (`resolve-static-pdf.ts`)
 * uses for PDFs, pulled out here so it isn't duplicated between
 * `scripts/legacy-media-hash-diff.ts` and `scripts/prepare-perceptual-match.ts`.
 */

export interface ResolvedImageBytes {
	bytes: Buffer;
	content_type: string;
	source: "served" | "live";
}

async function read_served_image(served_root: string, key: string) {
	const bytes = await fs
		.readFile(path.join(served_root, key))
		.catch(() => null);
	if (!bytes) return null;
	const extension = path.extname(key).slice(1).toLowerCase();
	return {
		bytes,
		content_type: mime.getType(extension) ?? "application/octet-stream",
	};
}

async function fetch_live_image(url: string) {
	try {
		const response = await fetch(url);
		if (!response.ok) return null;
		return {
			bytes: Buffer.from(await response.arrayBuffer()),
			content_type:
				response.headers.get("content-type") ?? "application/octet-stream",
		};
	} catch {
		return null; // flaky network / dropped connection - treated like a 404
	}
}

export async function resolve_legacy_image_bytes(
	served_root: string,
	url: string,
	key: string,
): Promise<ResolvedImageBytes | null> {
	const served = await read_served_image(served_root, key);
	if (served) return { ...served, source: "served" };

	const live = await fetch_live_image(url);
	if (live) return { ...live, source: "live" };

	return null;
}
