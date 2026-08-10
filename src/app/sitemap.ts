import { and, eq } from "drizzle-orm";
import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "~/lib/site-config";
import { EXCLUDE_CONTENT_KIND } from "~/server/article/article-queries";
import { find_primary_slug_or_first } from "~/server/article/lifecycle-rules";
import { db } from "~/server/db";
import { Article } from "~/server/db/schema";

// Revalidated on a fixed schedule rather than per-mutation — publishing is
// infrequent enough that an hour of staleness is a non-issue, and
// `ROOT_PATHS` in `~/lib/cache-policy.ts` also revalidates `/sitemap.xml` on
// every publish/archive/delete anyway, so this is just an upper bound.
export const revalidate = 3600;

// Every `page.tsx` under `src/app/` that isn't admin (`/uredi`, `/prijava`),
// internal-tooling (`/preveri`), an API route, or the `/novica/[slug]`
// dynamic segment handled separately below.
const STATIC_ROUTES = [
	"/",
	"/arhiv",
	"/avtorji",
	"/kontakt",
	"/klub",
	"/publiciranje",
	"/raziskovanje",
	"/varstvo",
	"/zgodovina",
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	// Content-kind rows live at their own fixed route (already in
	// STATIC_ROUTES below) — a /novica/<slug> entry for them here would be a
	// duplicate-content sitemap entry alongside it.
	const published_articles = await db.query.Article.findMany({
		where: and(eq(Article.status, "published"), EXCLUDE_CONTENT_KIND),
		columns: { updated_at: true },
		with: { article_slugs: true },
	});

	const article_entries: MetadataRoute.Sitemap = [];
	for (const article of published_articles) {
		const slug = find_primary_slug_or_first(article.article_slugs)?.slug;
		if (!slug) continue;

		article_entries.push({
			url: `${SITE_ORIGIN}/novica/${encodeURIComponent(slug)}`,
			lastModified: article.updated_at,
		});
	}

	const static_entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
		url: `${SITE_ORIGIN}${path}`,
	}));

	return [...static_entries, ...article_entries];
}
