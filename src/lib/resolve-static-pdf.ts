import fs from "node:fs/promises";
import path from "node:path";

/**
 * Resolves a hotlinked `www.jknm.si/media/...` PDF url to bytes, preferring
 * the local `served` mirror (path-for-path from site root) over a live
 * fetch. Shared by the static-page and article-content dehotlinking scripts
 * so both trust the same source order and the same "is this really a PDF"
 * check — the old ASP server returns HTTP 200 with a generic HTML error page
 * for some urls instead of a real 404, so status alone can't be trusted.
 */

const PDF_MAGIC = Buffer.from("%PDF-");

function is_pdf(bytes: Buffer) {
	return bytes.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC);
}

async function read_served_pdf(served_path: string) {
	let bytes: Buffer;
	try {
		bytes = await fs.readFile(served_path);
	} catch {
		return null;
	}
	if (!is_pdf(bytes)) {
		throw new Error(`${served_path} exists but isn't a PDF`);
	}
	return bytes;
}

async function fetch_live_pdf(url: string) {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.status}`);
	}
	const bytes = Buffer.from(await response.arrayBuffer());
	if (!is_pdf(bytes)) {
		throw new Error(
			`Fetched ${url} but response isn't a PDF (likely a disguised error page)`,
		);
	}
	return bytes;
}

export async function resolve_pdf_bytes(
	url: string,
	key: string,
	served_root: string,
) {
	const served_path = path.join(served_root, key);
	const served_bytes = await read_served_pdf(served_path);
	if (served_bytes) return { bytes: served_bytes, source: "served" as const };

	const bytes = await fetch_live_pdf(url);
	return { bytes, source: "live" as const };
}
