/**
 * Extraction of still-hotlinked www.jknm.si references from the static MDX
 * pages (src/app/(static)) — see docs/research/static-pages-jknm-si-dehotlinking.md
 * and ADR-0008. Pure string -> data, no I/O, so it stays testable without the
 * `served` mirror, the network, or B2.
 *
 * Two distinct reference shapes, each with its own resolver downstream:
 *  - /media/... links are files (all PDFs so far) that need self-hosting.
 *  - /si/?id=<legacy_id> links are old-CMS article pages, resolved via
 *    `Article.legacy_id` instead of a file copy.
 *
 * EditorJS article content stores its HTML with entities escaped, so the
 * same link appears as `?id=147&amp;l=2010` rather than `&l=2010` — the
 * `&(?:amp;)?l=` branch below covers both the raw MDX and escaped-JSON forms
 * without needing a separate regex per source.
 */

const PDF_REF_RE = /https?:\/\/(?:[a-z0-9-]+\.)?jknm\.si\/media\/[^)\s"\\]+/g;
const LEGACY_ID_REF_RE =
	/https?:\/\/(?:[a-z0-9-]+\.)?jknm\.si\/si\/\?id=(\d+)(?:&(?:amp;)?l=\d+)?/g;

export function find_pdf_refs(mdx: string): string[] {
	return [...new Set(mdx.match(PDF_REF_RE) ?? [])];
}

export interface LegacyIdRef {
	raw: string;
	legacy_id: number;
}

export function find_legacy_id_refs(mdx: string): LegacyIdRef[] {
	const seen = new Map<string, LegacyIdRef>();
	for (const match of mdx.matchAll(LEGACY_ID_REF_RE)) {
		const raw = match[0];
		const id_str = match[1];
		if (!seen.has(raw) && id_str) {
			seen.set(raw, { raw, legacy_id: Number(id_str) });
		}
	}
	return [...seen.values()];
}

/** The B2 key (and `served`-mirror relative path) for a /media/... url. */
export function static_asset_key(url: string): string {
	return new URL(url).pathname.replace(/^\/+/, "");
}
