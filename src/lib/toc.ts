/** Shared shape produced by both TOC producers (static MDX pages and EditorJS articles). */
export interface TocEntry {
	id: string;
	title: string;
	depth: number;
}

/** Heading levels both TOC producers (static MDX pages and EditorJS articles) include. */
export const TOC_HEADING_LEVELS: readonly number[] = [2, 3];
