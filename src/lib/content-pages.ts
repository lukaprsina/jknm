/**
 * The 5 fixed content-kind routes' slugs, in navbar order — remint-gated
 * (#35), so these never drift from their folder names under
 * `src/app/(static)/`. Shared between `create_content_page` (one route file
 * per slug) and `get_static_nav_sections` (the navbar dropdown) so adding or
 * renaming a content page can't desync the two: both read this one array,
 * and a route file passing a slug outside it fails typecheck.
 */
export const CONTENT_PAGE_SLUGS = [
	"zgodovina",
	"raziskovanje",
	"publiciranje",
	"varstvo",
	"klub",
] as const;

export type ContentPageSlug = (typeof CONTENT_PAGE_SLUGS)[number];
