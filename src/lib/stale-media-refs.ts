/**
 * Extraction and rewriting of *stale asset hosts* left inside article
 * `content_json` — the storage backends this site used before
 * `gradivo.jknm.org`, still hardcoded into hundreds of image blocks and
 * inline `<a href>`s.
 *
 * Pure string -> data, no I/O, so the parts that can silently corrupt 700
 * articles are testable without a database, a bucket, or the network. The
 * script that drives this is `scripts/rescue-stale-media.ts`.
 *
 * Two stale hosts, with very different urgency:
 *  - `jknm-novice.s3.eu-central-003.backblazeb2.com` — Backblaze's *native*
 *    endpoint (not the Cloudflare-fronted domain ADR-0008 mandates). Returns
 *    404 today: these images are already broken in production.
 *  - `jknm.s3.eu-central-1.amazonaws.com` — the original AWS bucket. Still
 *    serving, but on an account this project doesn't control, so every one of
 *    these is a link that dies whenever someone else stops paying.
 *
 * Both used the same `<article-slug>/<filename>` key layout, which is what
 * makes recovery possible at all: the AWS bucket still holds the bytes for
 * keys the Backblaze one now 404s (verified), so a dead url can be retried
 * against AWS unchanged.
 */

export const BACKBLAZE_NATIVE_HOST =
	"jknm-novice.s3.eu-central-003.backblazeb2.com";
export const LEGACY_AWS_HOST = "jknm.s3.eu-central-1.amazonaws.com";

const STALE_ASSET_RE = new RegExp(
	`https?://(?:${BACKBLAZE_NATIVE_HOST}|${LEGACY_AWS_HOST})/[^"'\\s\\\\<>)]+`.replace(
		/\./g,
		"\\.",
	),
	"g",
);

/**
 * A truncated `www.jknm.si` prefix glued directly onto a full absolute url,
 * e.g. `http://www.jknm.sihttps://jknm.s3.../x.pdf`. An old editor prepended
 * the site root to hrefs that were already absolute; the result is a dead
 * link that *contains* a live one.
 *
 * This matters beyond the 12 occurrences: a naive `jknm\.si` pattern matches
 * the prefix here and, if used for rewriting, would splice a replacement into
 * the middle of a url and destroy the recoverable part. So the prefix is
 * stripped as a first, separate pass — after which these are ordinary stale
 * asset urls and need no special handling anywhere else.
 */
const CONCAT_PREFIX_RE = /https?:\/\/(?:www\.)?jknm\.si(?=https?:\/\/)/g;

export function strip_concatenated_prefixes(text: string) {
	return text.replace(CONCAT_PREFIX_RE, "");
}

export function count_concatenated_prefixes(text: string) {
	return (text.match(CONCAT_PREFIX_RE) ?? []).length;
}

/** Distinct stale-host asset urls in `text`, in first-appearance order. */
export function find_stale_asset_urls(text: string): string[] {
	return [...new Set(text.match(STALE_ASSET_RE) ?? [])];
}

/**
 * The same object's url on the legacy AWS bucket, or null if `url` is already
 * pointing there. The shared key layout makes this a host swap and nothing
 * more — see the module docstring.
 */
export function aws_fallback_url(url: string): string | null {
	if (!url.includes(BACKBLAZE_NATIVE_HOST)) return null;
	return url.replace(
		new RegExp(`https?://${BACKBLAZE_NATIVE_HOST.replace(/\./g, "\\.")}`),
		`https://${LEGACY_AWS_HOST}`,
	);
}

/**
 * Substitute urls throughout `text`.
 *
 * Longest key first, so a url that is a prefix of another (`.../slika_1.jpg`
 * vs `.../slika_1.jpg?x=1`, or a directory-ish key) can't be rewritten out
 * from under the longer one and leave a spliced-together hybrid behind.
 */
export function rewrite_urls(text: string, replacements: Map<string, string>) {
	let result = text;
	const keys = [...replacements.keys()].sort((a, b) => b.length - a.length);
	for (const from of keys) {
		const to = replacements.get(from);
		if (to) result = result.split(from).join(to);
	}
	return result;
}
