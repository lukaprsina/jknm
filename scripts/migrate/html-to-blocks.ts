/**
 * Deterministic HTML -> EditorJS-blocks converter for the static-page
 * migration (#36). Pure and synchronous by design: image/PDF `<a>` targets
 * are left pointing at the original `vsebina.jknm.org` hotlink rather than
 * being re-ingested here -- that happens in a later, impure pass
 * (`vsebina-postpass.ts`) that rewrites both wherever they occur in the
 * serialized blocks. See `docs/research/zgodovina-html-to-editorjs-mapping.md`
 * for the element-by-element mapping this implements.
 */

import { type HTMLElement, parse } from "node-html-parser";
import type { ArticleBlockType } from "~/server/db/schema";

export function extract_static_content_html(page_html: string): string {
	const root = parse(page_html);
	const h1 = root.querySelector("h1");
	const container = h1?.parentNode;
	if (!container) throw new Error("No <h1> found in page HTML");
	return container.innerHTML;
}

interface HeaderBlockData {
	text: string;
	level: number;
}
interface ParagraphBlockData {
	text: string;
}
interface ListItemData {
	content: string;
	meta: Record<string, never>;
	items: ListItemData[];
}
interface ListBlockData {
	style: "unordered" | "ordered";
	items: ListItemData[];
}
interface ImageBlockData {
	caption: string;
	file: { url: string; width?: number; height?: number };
}
interface TableBlockData {
	withHeadings: boolean;
	content: string[][];
}

function to_header_block(el: HTMLElement, level: number): ArticleBlockType {
	return {
		type: "header",
		data: { text: el.innerHTML.trim(), level } satisfies HeaderBlockData,
	};
}

function to_paragraph_block(el: HTMLElement): ArticleBlockType {
	return {
		type: "paragraph",
		data: { text: el.innerHTML.trim() } satisfies ParagraphBlockData,
	};
}

function to_list_block(
	el: HTMLElement,
	style: ListBlockData["style"],
): ArticleBlockType {
	return {
		type: "list",
		data: {
			style,
			items: el.children.map(
				(li): ListItemData => ({
					content: li.innerHTML.trim(),
					meta: {},
					items: [],
				}),
			),
		} satisfies ListBlockData,
	};
}

function to_dimension(
	attr: string | undefined,
	name: string,
): number | undefined {
	if (!attr) return undefined;
	const value = Number(attr);
	if (Number.isNaN(value)) {
		throw new Error(`<img ${name}="${attr}"> is not a number`);
	}
	return value;
}

function to_image_block(el: HTMLElement): ArticleBlockType {
	const img = el.querySelector("img");
	if (!img) throw new Error("<figure> with no <img>");
	const width = to_dimension(img.getAttribute("width"), "width");
	const height = to_dimension(img.getAttribute("height"), "height");
	return {
		type: "image",
		data: {
			caption: el.querySelector("figcaption")?.innerHTML.trim() ?? "",
			file: {
				url: img.getAttribute("src") ?? "",
				...(width !== undefined ? { width } : {}),
				...(height !== undefined ? { height } : {}),
			},
		} satisfies ImageBlockData,
	};
}

function to_table_block(el: HTMLElement): ArticleBlockType {
	const rows = el.querySelectorAll("tr");
	if (rows.length === 0) throw new Error("<table> with no <tr>");
	return {
		type: "table",
		data: {
			withHeadings: true,
			content: rows.map((row) =>
				row.querySelectorAll("th, td").map((cell) => cell.innerHTML.trim()),
			),
		} satisfies TableBlockData,
	};
}

export function html_to_blocks(container_html: string): ArticleBlockType[] {
	const root = parse(container_html);
	const children = root.children;
	const blocks: ArticleBlockType[] = [];

	for (const [index, el] of children.entries()) {
		if (index === 0 && el.tagName === "H1") continue;

		switch (el.tagName) {
			case "H2":
				blocks.push(to_header_block(el, 2));
				break;
			case "H3":
				blocks.push(to_header_block(el, 3));
				break;
			case "H4":
				blocks.push(to_header_block(el, 4));
				break;
			case "P":
				blocks.push(to_paragraph_block(el));
				break;
			case "UL":
				blocks.push(to_list_block(el, "unordered"));
				break;
			case "OL":
				blocks.push(to_list_block(el, "ordered"));
				break;
			case "FIGURE":
				blocks.push(to_image_block(el));
				break;
			case "TABLE":
				blocks.push(to_table_block(el));
				break;
			default:
				throw new Error(
					`Unhandled top-level element <${el.tagName.toLowerCase()}> -- add a mapping in docs/research/zgodovina-html-to-editorjs-mapping.md and html-to-blocks.ts before converting this page`,
				);
		}
	}

	return blocks;
}
