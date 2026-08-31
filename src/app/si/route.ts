import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import {
	is_valid_legacy_id,
	resolve_legacy_id_redirect,
} from "~/lib/legacy-si-paths";
import { legacy_gone, legacy_redirect } from "~/lib/site-config";
import { find_article_with_relations } from "~/server/article/article-queries";
import { db } from "~/server/db";
import { Article } from "~/server/db/schema";

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

	if (!is_valid_legacy_id(id)) {
		return legacy_gone();
	}

	const article = await find_article_with_relations(
		db,
		eq(Article.legacy_id, Number(id)),
	);

	const resolution = resolve_legacy_id_redirect(article ?? null);

	if (resolution.outcome === "gone") {
		return legacy_gone();
	}

	// 308, matching `permanentRedirect()`'s status elsewhere on the site
	// (the non-primary-slug redirect on `/novica/[slug]`) — 301 and 308 are
	// equivalent to Google, so this is a consistency choice, not a
	// correctness one.
	return legacy_redirect(resolution.path, request);
}
