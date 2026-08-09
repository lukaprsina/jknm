/**
 * The 5 static pages being migrated (#33/#36), keyed by the slug their
 * folder under `src/app/(static)/` already uses. `title` seeds the fresh
 * draft's title field (and its initial header block, from `create_article`)
 * -- independent of whatever `<h1>` the page's own MDX content starts with,
 * which arrives as part of the pasted HTML.
 */
export const STATIC_PAGES = {
	zgodovina: { route: "/zgodovina", title: "Zgodovina" },
	klub: { route: "/klub", title: "Klub" },
	raziskovanje: { route: "/raziskovanje", title: "Raziskovanje" },
	varstvo: { route: "/varstvo", title: "Varstvo" },
	publiciranje: { route: "/publiciranje", title: "Publiciranje" },
} as const;

export type StaticPageSlug = keyof typeof STATIC_PAGES;

export function is_static_page_slug(value: string): value is StaticPageSlug {
	return value in STATIC_PAGES;
}
