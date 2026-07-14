import type { OutputData } from "@editorjs/editorjs";

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
