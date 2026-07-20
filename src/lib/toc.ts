import type { Toc } from "@stefanprobst/rehype-extract-toc";

/** Shared shape produced by both TOC producers (static MDX pages and EditorJS articles). */
export interface TocEntry {
	id: string;
	title: string;
	depth: number;
}

/** Heading levels both TOC producers (static MDX pages and EditorJS articles) include. */
export const TOC_HEADING_LEVELS: readonly number[] = [2, 3];

/** Flattens rehype-extract-toc's nested tree into the flat shared `TocEntry[]` shape, keeping only `TOC_HEADING_LEVELS`. */
export function flatten_toc(
	toc: Toc,
	levels: readonly number[] = TOC_HEADING_LEVELS,
): TocEntry[] {
	const entries: TocEntry[] = [];

	const visit = (nodes: Toc) => {
		for (const node of nodes) {
			if (node.id && levels.includes(node.depth)) {
				entries.push({ id: node.id, title: node.value, depth: node.depth });
			}
			if (node.children) visit(node.children);
		}
	};

	visit(toc);
	return entries;
}
