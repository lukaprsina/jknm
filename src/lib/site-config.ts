/**
 * Canonical production origin, for anything that must be an absolute URL a
 * crawler will see: `metadataBase`, `sitemap.ts`, `robots.ts`'s `sitemap`
 * field. Deliberately not `get_base_url()` (`~/lib/get-base-url.ts`) — that
 * falls back to `NEXT_PUBLIC_NEXTAUTH_URL`, which itself falls back to
 * `VERCEL_URL` on Vercel deployments, so it resolves to a `.vercel.app`
 * alias rather than the real domain. No env var owns this today, and it
 * only has one real value, so a constant beats inventing one.
 */
import { type NextRequest, NextResponse } from "next/server";

export const SITE_ORIGIN = "https://www.jknm.si";

/**
 * CDN-cacheable for a day: shared by every legacy-`/si/*` redirect
 * (`si/route.ts`, `si/[...path]/route.ts`), which only ever exist to absorb
 * crawler/bookmark traffic hitting known-stable old URLs — letting Vercel's
 * edge serve repeat hits directly is a free win.
 */
const REDIRECT_CACHE_CONTROL =
	"public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";

/** A legacy-`/si/*` URL that's known permanently gone, no redirect target. */
export function legacy_gone(): NextResponse {
	return new NextResponse(null, { status: 410 });
}

/** A legacy-`/si/*` URL's permanent redirect to its current equivalent. */
export function legacy_redirect(
	path: string,
	request: NextRequest,
): NextResponse {
	return NextResponse.redirect(new URL(path, request.url), {
		status: 308,
		headers: { "Cache-Control": REDIRECT_CACHE_CONTROL },
	});
}
