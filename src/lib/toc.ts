/** Shared shape produced by every TOC producer (news articles and content-kind pages, both EditorJS-backed). */
export interface TocEntry {
	id: string;
	title: string;
	depth: number;
}

/** Default heading levels a TOC includes -- H1 is added separately, see `EditorToReact`'s `h1_id`. */
export const TOC_HEADING_LEVELS: readonly number[] = [2, 3];
