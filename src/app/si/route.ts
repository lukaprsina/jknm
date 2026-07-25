import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { legacy_gone, legacy_redirect } from "~/lib/site-config";
import { find_article_with_relations } from "~/server/article/article-queries";
import { find_primary_slug_or_first } from "~/server/article/lifecycle-rules";
import { db } from "~/server/db";
import { Article } from "~/server/db/schema";

const LEGACY_ID_RE = /^\d+$/;

// Postgres `integer` (what `Article.legacy_id` is) tops out here — an
// all-digit id past this overflows the column and the driver throws,
// turning a "this id never existed" case into a 500 instead of the 410 it
// should be.
const PG_INT_MAX = 2147483647;

/**
 * Legacy URL shape: `https://www.jknm.si/si/?id=<legacy_id>&l=<year>`. `l`
 * was the old sidebar's archive-year filter, cosmetic to the article itself
 * — safe to drop. `/si/` was the only language path on the old site and
 * this route replaces it entirely; it never renders anything itself.
 *
 * Redirect-only, so a Route Handler rather than a page — a `page.tsx` at
 * this segment would be a build error anyway (`app/si/route.ts` and
 * `app/si/page.tsx` can't coexist).
 */
export async function GET(request: NextRequest) {
	const id = request.nextUrl.searchParams.get("id");

	if (!id) {
		return NextResponse.redirect(new URL("/", request.url), 301);
	}

	if (!LEGACY_ID_RE.test(id) || Number(id) > PG_INT_MAX) {
		return legacy_gone();
	}

	const article = await find_article_with_relations(
		db,
		eq(Article.legacy_id, Number(id)),
	);

	// Anything not `published` (draft/archived/deleted) 410s rather than
	// redirecting: these are inbound links from search results and old
	// bookmarks, not an admin surface, so there's no session to branch on —
	// unlike `/novica/[slug]`'s `is_visible_to`, which does gate archived
	// articles in for signed-in admins.
	if (article?.status !== "published") {
		return legacy_gone();
	}

	const slug = find_primary_slug_or_first(article.article_slugs)?.slug;

	if (!slug) {
		return legacy_gone();
	}

	// 308, matching `permanentRedirect()`'s status elsewhere on the site
	// (the non-primary-slug redirect on `/novica/[slug]`) — 301 and 308 are
	// equivalent to Google, so this is a consistency choice, not a
	// correctness one.
	return legacy_redirect(`/novica/${encodeURIComponent(slug)}`, request);
}
