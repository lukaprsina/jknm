import type EditorJS from "@editorjs/editorjs";
import type { OutputData } from "@editorjs/editorjs";
import { convert_title_to_url } from "~/lib/article-utils";
import {
	extract_media_refs_from_content,
	get_heading_from_editor,
} from "~/lib/editor-utils";
import type { ThumbnailType } from "~/lib/validators";
import { editor_store } from "./editor-store";

const HEADING_ERROR_MESSAGE = {
	NO_HEADING: "Naslov ni nastavljen — prva vrstica mora biti H1 naslov.",
	WRONG_HEADING_LEVEL:
		"Naslov ni pravilne ravni — prva vrstica mora biti H1 naslov.",
} as const;

export interface EditorCommitResult {
	editor_content: OutputData;
	title: string;
	url: string;
	error?: string;
}

/**
 * Reads the EditorJS instance's current content, derives title/url/image
 * refs from it, and writes the result into `editor_store` — the one place
 * this derive-then-store-write happens, called from every site that needs a
 * fresh snapshot of the editor (initial mount, save, publish). `author_ids`
 * is deliberately not part of this: the toolbar's MultiSelect is its only
 * writer, so it isn't derived from editor content like the rest of the store.
 */
export async function commitEditorState({
	editor,
	article,
	overrides,
}: {
	editor: EditorJS | undefined;
	article: { id: string; title: string };
	overrides?: { published_at?: Date; thumbnail_crop?: ThumbnailType };
}): Promise<EditorCommitResult | undefined> {
	const editor_content = await editor?.save();
	if (!editor_content) return undefined;

	const { title: heading_title, error: heading_error } =
		get_heading_from_editor(editor_content);
	const title = heading_title ?? article.title;
	const url = convert_title_to_url(title);

	const image_data = extract_media_refs_from_content(editor_content, [
		"image",
	]).map((ref) => ref.data);

	const thumbnail_crop =
		overrides?.thumbnail_crop ?? editor_store.getState().thumbnail_crop ?? undefined;

	editor_store.setState({
		draft_id: article.id,
		image_data,
		title,
		url,
		s3_url: "",
		...(thumbnail_crop && { thumbnail_crop }),
		...(overrides?.published_at && { published_at: overrides.published_at }),
	});

	return {
		editor_content,
		title,
		url,
		error: heading_error ? HEADING_ERROR_MESSAGE[heading_error] : undefined,
	};
}
