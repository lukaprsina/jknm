import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "~/lib/site-config";

/**
 * `Allow: /` under `userAgent: "*"` already covers every named crawler,
 * AI bots included (`GPTBot`, `ClaudeBot`, etc. — none has a `robots.txt`
 * disallow anywhere). `Google-Extended`/`Applebot-Extended` are AI-training
 * opt-out *control tokens*, not crawlers, so there's nothing to "allow" for
 * them; adding a bare per-bot group would be a no-op at best, and a footgun
 * at worst under RFC 9309's most-specific-group-wins rule (a bot with its
 * own group would ignore the `disallow` list below entirely).
 *
 * `/uredi`, `/preveri`, `/prijava` are already access-controlled via
 * `getServerAuthSession()` — this isn't a security boundary, just keeping
 * admin/internal-tooling URLs out of the index and off crawl budget.
 */
export default function robots(): MetadataRoute.Robots {
	return {
		rules: [
			{
				userAgent: "*",
				allow: "/",
				disallow: ["/uredi/", "/preveri/", "/prijava/", "/api/"],
			},
		],
		sitemap: `${SITE_ORIGIN}/sitemap.xml`,
	};
}
