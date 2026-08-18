import fs from "node:fs/promises";
import path from "node:path";
import mime from "mime/lite";

/**
 * Served-mirror-first, live-fetch-fallback byte resolution for legacy
 * *images* — the same pattern `resolve_pdf_bytes` (`resolve-static-pdf.ts`)
 * uses for PDFs, pulled out here so it isn't duplicated between
 * `scripts/legacy-media-hash-diff.ts` and `scripts/prepare-perceptual-match.ts`.
 *
 * Also mirrors `resolve_pdf_bytes`'s magic-byte check: the old ASP server
 * returns HTTP 200 with a generic HTML error page for some dead urls instead
 * of a real 404 (confirmed on legacy_id 534's `slika_5.JPG` - the "fetched"
 * bytes were a 529-byte "Napaka | Error" page), so an ok status alone can't
 * be trusted. Checked against a fixed set of magic bytes rather than a
 * dependency like `file-type` - the legacy site only ever serves jpg/png/gif
 * under this path, so this is the same few-constants shape as `PDF_MAGIC`.
 *
 * Unlike `resolve_pdf_bytes`, a served-mirror mismatch doesn't throw: unlike
 * the pdf-href scan, `extract_legacy_media_paths` matches *any* file under
 * `/media/img/novice/...` regardless of extension (confirmed - an `.xls`
 * attachment, `Tecaj_jamar_pripravnik_2014.xls`, lives under that path
 * scheme), so a mismatch there means "this ref was never an image to begin
 * with," not mirror corruption. Treated like a miss (falls through to live,
 * then to `unresolved`) rather than a hard error.
 */

export interface ResolvedImageBytes {
	bytes: Buffer;
	content_type: string;
	source: "served" | "live";
}

const IMAGE_MAGICS = [
	Buffer.from([0xff, 0xd8, 0xff]), // JPEG
	Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // PNG
	Buffer.from("GIF8"), // GIF87a / GIF89a
];

function is_image(bytes: Buffer) {
	return IMAGE_MAGICS.some((magic) =>
		bytes.subarray(0, magic.length).equals(magic),
	);
}

async function read_served_image(served_root: string, key: string) {
	const bytes = await fs
		.readFile(path.join(served_root, key))
		.catch(() => null);
	if (!bytes) return null;
	if (!is_image(bytes)) return null; // ref wasn't actually an image (e.g. a doc/xls under the same path scheme)
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
		const bytes = Buffer.from(await response.arrayBuffer());
		if (!is_image(bytes)) return null; // disguised error page - treated like a 404
		return {
			bytes,
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
