import type { OutputData } from "@editorjs/editorjs";
import sanitizeHtml from "sanitize-html";
import { convert_title_to_url } from "./article-utils";
import { MEDIA_PUBLIC_DOMAIN } from "./media-upload";
import { TOC_HEADING_LEVELS, type TocEntry } from "./toc";

interface HeadingReturnType {
	title?: string;
	error?: "NO_HEADING" | "WRONG_HEADING_LEVEL";
}

export function get_heading_from_editor(
	editor_content: OutputData,
): HeadingReturnType {
	const first_block = editor_content.blocks[0];

	if (first_block?.type === "header") {
		const first_header = first_block.data as {
			text: string;
			level: number;
		};

		const title = first_header.text.trim();
		if (first_header.level === 1) {
			return { title };
		} else {
			return { title, error: "WRONG_HEADING_LEVEL" };
		}
	} else {
		return { error: "NO_HEADING" };
	}
}

export interface EditorJSImageData {
	caption: string;
	file: {
		url: string;
		width?: number;
		height?: number;
	};
	stretched?: boolean;
	withBackground?: boolean;
	withBorder?: boolean;
}

export interface EditorJSFileData {
	file: {
		url: string;
		size: number;
		name: string;
		extension: string;
	};
	title: string;
}

const MEDIA_BLOCK_TYPES = ["image", "attaches"] as const;
export type MediaBlockType = (typeof MEDIA_BLOCK_TYPES)[number];

export type MediaBlockRef =
	| { id: string | undefined; type: "image"; data: EditorJSImageData }
	| { id: string | undefined; type: "attaches"; data: EditorJSFileData };

/**
 * Extracts media-carrying blocks (image/attaches) from EditorJS content.
 * `data` references the same object as the block in `content` (not a clone),
 * so callers holding onto a cloned `content` can mutate it through `data`.
 */
export function extract_media_refs_from_content(
	content: OutputData,
	types: readonly ["image"],
): Extract<MediaBlockRef, { type: "image" }>[];
export function extract_media_refs_from_content(
	content: OutputData,
	types: readonly ["attaches"],
): Extract<MediaBlockRef, { type: "attaches" }>[];
export function extract_media_refs_from_content(
	content: OutputData,
	types?: readonly MediaBlockType[],
): MediaBlockRef[];
export function extract_media_refs_from_content(
	content: OutputData,
	types: readonly MediaBlockType[] = MEDIA_BLOCK_TYPES,
): MediaBlockRef[] {
	return content.blocks
		.filter((block) => types.includes(block.type as MediaBlockType))
		.map((block) => {
			if (block.type === "image") {
				return {
					id: block.id,
					type: "image",
					data: block.data as EditorJSImageData,
				};
			}
			return {
				id: block.id,
				type: "attaches",
				data: block.data as EditorJSFileData,
			};
		});
}

/**
 * Media urls that appear anywhere in a block's data *other* than as an
 * image/attaches block — in practice `<a href="https://gradivo.jknm.org/...">`
 * inside a paragraph's inline HTML, which is how the club's PDFs are linked
 * from prose.
 *
 * `extract_media_refs_from_content` can't see these: it filters by
 * `block.type`, so an inline-linked PDF looks like an article that references
 * no media at all. Left unreconciled it has no `media_to_articles` row, and
 * `scripts/sweep-stale-content.ts` deletes exactly that — media with no link
 * and no thumbnail use — 48h later, taking a live, linked-to file with it.
 *
 * Matching by serialized block data rather than by parsing the HTML is
 * deliberate: any block type can carry inline HTML (list, quote, table), and
 * the only thing being asserted is "this article points at this media", which
 * doesn't depend on where in the block the url sits. Image/attaches blocks
 * match too; callers dedupe.
 */
const MEDIA_URL_RE = new RegExp(
	`https://${MEDIA_PUBLIC_DOMAIN.replace(/\./g, "\\.")}/[^"'\\s\\\\<>)]+`,
	"g",
);

export function extract_inline_media_urls(content: OutputData): string[] {
	const urls = new Set<string>();
	for (const block of content.blocks) {
		for (const url of JSON.stringify(block.data).match(MEDIA_URL_RE) ?? []) {
			urls.add(url);
		}
	}
	return [...urls];
}

export interface HeadingEntry extends TocEntry {
	/** Index into `content.blocks`, used to line up ids with the rendered header block. */
	block_index: number;
}

/**
 * Extracts headings from EditorJS content as a flat, deduped, slugged TOC
 * (mirrors `rehype-slug`: first occurrence unsuffixed, later duplicates get
 * a numeric suffix). Excludes the article's H1 (block 0) by default -- pass
 * `levels` including `1` to include it (see `EditorToReact`'s `headings`).
 */
export function extract_headings_from_content(
	content: OutputData,
	levels: readonly number[] = TOC_HEADING_LEVELS,
): HeadingEntry[] {
	const seen = new Map<string, number>();
	const headings: HeadingEntry[] = [];

	content.blocks.forEach((block, block_index) => {
		if (block.type !== "header") return;

		const data = block.data as { text: string; level: number };
		if (!levels.includes(data.level)) return;

		const title = sanitizeHtml(data.text, { allowedTags: [] }).trim();
		if (!title) return;

		let id = convert_title_to_url(title, () => `section-${block_index}`);
		const occurrence = seen.get(id) ?? 0;
		seen.set(id, occurrence + 1);
		if (occurrence > 0) id = `${id}-${occurrence}`;

		headings.push({ id, title, depth: data.level, block_index });
	});

	return headings;
}
