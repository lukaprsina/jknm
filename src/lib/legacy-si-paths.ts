/**
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
 * rules) and `klub/interes` (Društvo v javnem interesu status) fall in that
 * "dropped" set too, but not because the content is gone — it's folded into
 * the `/klub` content-kind page's text (verified against `Article.content_json`
 * where `article_kind = "content"`), just not at a URL that maps 1:1 from the
 * old path. `410` here is correct: there's no single equivalent page to
 * redirect *to*, only a mention within a differently-organized one. Old
 * inbound links to these two paths are intentionally left unrewritten in
 * article content too — see `LINKS.md`.
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
