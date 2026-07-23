import type { Toc } from "@stefanprobst/rehype-extract-toc";
import { tableOfContents as klub_toc } from "~/app/(static)/klub/content.mdx";
import { tableOfContents as publiciranje_toc } from "~/app/(static)/publiciranje/content.mdx";
import { tableOfContents as raziskovanje_toc } from "~/app/(static)/raziskovanje/content.mdx";
import { tableOfContents as varstvo_toc } from "~/app/(static)/varstvo/content.mdx";
import { tableOfContents as zgodovina_toc } from "~/app/(static)/zgodovina/content.mdx";
import { flatten_toc } from "./toc";

export interface NavSection {
	section: string;
	title: string;
	headings: { id: string; title: string }[];
}

const STATIC_PAGES: { section: string; title: string; toc: Toc }[] = [
	{ section: "zgodovina", title: "Zgodovina", toc: zgodovina_toc },
	{ section: "raziskovanje", title: "Raziskovanje", toc: raziskovanje_toc },
	{ section: "publiciranje", title: "Publiciranje", toc: publiciranje_toc },
	{ section: "varstvo", title: "Varstvo", toc: varstvo_toc },
	{ section: "klub", title: "Klub", toc: klub_toc },
];

// Not a static page (no content.mdx) -- an archive listing route -- so it
// never has headings, only a link.
const ARHIV_SECTION: NavSection = {
	section: "arhiv",
	title: "Arhiv novic",
	headings: [],
};

/**
 * Navbar dropdown data, computed once at module load from the same
 * `tableOfContents` export (real `rehype-slug` ids) each static page's own
 * `<StaticPageToc>` renders -- so a navbar link can never point at an anchor
 * id its target page doesn't actually have.
 */
export const STATIC_NAV_SECTIONS: NavSection[] = [
	...STATIC_PAGES.map(({ section, title, toc }) => ({
		section,
		title,
		headings: flatten_toc(toc, [2]).map((entry) => ({
			id: entry.id,
			title: entry.title,
		})),
	})),
	ARHIV_SECTION,
];
