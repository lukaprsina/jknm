import { find_primary_slug_or_first } from "~/server/article/lifecycle-rules";

/**
 * Old `www.jknm.si/si/*` URLs came in two shapes: static section paths
 * (`resolve_legacy_static_path`) and `?id=<legacy_id>` article links
 * (`is_valid_legacy_id` + `resolve_legacy_id_redirect`). Both boil down to
 * the same redirect-or-gone decision, pure and framework-free so each is
 * unit-testable without a running Next.js route.
 *
 * Maps old `www.jknm.si/si/<segments>/...` static-site paths (pre-rewrite,
 * classic-ASP server) onto their nearest equivalent on the new site, or
 * signals that the old section was deliberately retired.
 *
 * Only `klub`, `klub/zgodovina`, `publikacije`, `raziskovanje`, `varstvo`,
 * `etc/kontakt`, and `etc/iskanje` have a live equivalent — the admin kept
 * those updated. Everything else (`jame`, `kataster`, `jrs`, `izobrazevanje`,
 * `navodila`, `download`, `etc/clani`, `etc/impresum`, `varnost/*`, and the
 * `.htm` pages the old `robots.txt` already disallowed) was deemed
 * outdated/unimportant and dropped — `jame`/`kataster`'s cave-cadastre data
 * in particular now lives on JZS's site instead, so it 410s rather than
 * redirecting: sending an internal URL to an external domain would just
 * leak whatever link equity it has for no benefit to this site.
 *
 * `izobrazevanje/kodeks` (Etični kodeks, cave-visiting/research conduct
 * rules) has its content folded into the `/klub` content-kind page's text
 * (verified against `Article.content_json` where `article_kind = "content"`),
 * just not at a URL that maps 1:1 from the old path — there's no single
 * equivalent page to redirect *to*, only a mention within a
 * differently-organized one, so it 410s rather than redirecting.
 *
 * `klub/interes` (Društvo v javnem interesu status) is the same
 * folded-into-`/klub` situation, but redirects there anyway: any segment
 * under `klub` other than `zgodovina` falls through to `/klub` below, which
 * is close enough to be worth the redirect rather than a 410.
 *
 * Pure and framework-free so the mapping table is unit-testable without a
 * running Next.js route.
 */

export type LegacyStaticPathResolution =
	| { outcome: "redirect"; path: string }
	| { outcome: "gone" };

export function resolve_legacy_static_path(
	segments: string[],
): LegacyStaticPathResolution {
	const [first, second] = segments;

	switch (first) {
		case "klub":
			return {
				outcome: "redirect",
				path: second === "zgodovina" ? "/zgodovina" : "/klub",
			};
		case "publikacije":
			return { outcome: "redirect", path: "/publiciranje" };
		case "raziskovanje":
			return { outcome: "redirect", path: "/raziskovanje" };
		case "varstvo":
			return { outcome: "redirect", path: "/varstvo" };
		case "etc":
			if (second === "kontakt")
				return { outcome: "redirect", path: "/stik-z-nami" };
			if (second === "iskanje") return { outcome: "redirect", path: "/arhiv" };
			return { outcome: "gone" };
		default:
			return { outcome: "gone" };
	}
}

// Postgres `integer` (what `Article.legacy_id` is) tops out here — an
// all-digit id past this overflows the column and the driver throws,
// turning a "this id never existed" case into a 500 instead of the 410 it
// should be.
const PG_INT_MAX = 2147483647;

const LEGACY_ID_RE = /^\d+$/;

/** Whether a `?id=` query param is even worth looking up. */
export function is_valid_legacy_id(id: string): boolean {
	return LEGACY_ID_RE.test(id) && Number(id) <= PG_INT_MAX;
}

/**
 * Anything not `published` (draft/archived/deleted) 410s rather than
 * redirecting: these are inbound links from search results and old
 * bookmarks, not an admin surface, so there's no session to branch on —
 * unlike `/novica/[slug]`'s `is_visible_to`, which does gate archived
 * articles in for signed-in admins.
 */
export function resolve_legacy_id_redirect(
	article: {
		status: "draft" | "published" | "archived" | "deleted";
		article_slugs: { is_primary: boolean; slug: string }[];
	} | null,
): LegacyStaticPathResolution {
	if (article?.status !== "published") return { outcome: "gone" };

	const slug = find_primary_slug_or_first(article.article_slugs)?.slug;
	if (!slug) return { outcome: "gone" };

	return { outcome: "redirect", path: `/novica/${encodeURIComponent(slug)}` };
}
