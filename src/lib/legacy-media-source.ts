/**
 * Matching stale asset urls back to the legacy site's own served files
 * (`D:\Luka\JKNM\served`, a mirror of www.jknm.si), keyed by the article they
 * actually belong to.
 *
 * Why per-article, not by filename alone: the mirror has 3700+ images across
 * 16 years, filenames like `slika_1.jpg` recur in unrelated articles from
 * different decades, and a naive global basename lookup picks whichever one
 * sorts first — silently attaching the wrong photo to a published article.
 * Scoping candidates to the one article's own legacy content (Objave.txt row
 * or scraped legacy-html) makes collision a non-issue: a single article's
 * dozen images essentially never collide with each other.
 *
 * Why normalize rather than compare basenames verbatim: the legacy CMS and
 * whatever produced the B2 keys sanitized filenames differently — a served
 * `radescica_02__13_.JPG` is the asset behind a B2 key `radescica_02_13.jpg`.
 * Stripping everything but alphanumerics collapses both to the same token
 * while still keeping distinguishing digits apart (`slika_1` vs `slika_10`).
 */

const MEDIA_PATH_RE = /\/media\/img\/novice\/[^"'\s\\<>)]+/g;

/** Distinct `/media/img/novice/...` paths referenced in a legacy content blob (Objave.txt's html column, or a scraped legacy-html page), decoded and in first-appearance order. */
export function extract_legacy_media_paths(html: string): string[] {
	const matches = html.match(MEDIA_PATH_RE) ?? [];
	const decoded = matches.map((match) => {
		try {
			return decodeURIComponent(match);
		} catch {
			return match;
		}
	});
	return [...new Set(decoded)];
}

/** Lowercased, alphanumeric-only token used to compare filenames across sanitization schemes. */
export function normalize_basename(path_or_url: string): string {
	const basename = path_or_url.split(/[/\\]/).pop() ?? path_or_url;
	return basename.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * The one `candidate_paths` entry whose basename normalizes the same as
 * `stale_url`'s, or null if there isn't exactly one. Ambiguous matches (two
 * candidates normalizing the same way) are treated as no match rather than
 * guessed at — see the module docstring on why a wrong guess is worse than a
 * miss here.
 */
export function find_legacy_media_match(
	stale_url: string,
	candidate_paths: string[],
): string | null {
	const target = normalize_basename(stale_url);
	const matches = candidate_paths.filter(
		(candidate) => normalize_basename(candidate) === target,
	);
	return matches.length === 1 ? (matches[0] ?? null) : null;
}
