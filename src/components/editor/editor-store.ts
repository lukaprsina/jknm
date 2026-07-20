import { create } from "zustand";
import type { ThumbnailType } from "~/lib/validators";
import type { EditorJSImageData } from "../../lib/editor-utils";

export interface EditorStoreType {
	draft_id: string;
	title: string;
	url: string;
	s3_url: string;
	thumbnail_crop: ThumbnailType | null;
	image_data: EditorJSImageData[];
	author_ids: number[];
}

const initial_data: EditorStoreType = {
	draft_id: "",
	title: "",
	url: "",
	s3_url: "",
	thumbnail_crop: null,
	image_data: [],
	author_ids: [],
};

export const editor_store = create<EditorStoreType>(() => initial_data);

export function useAuthorIds(): number[] {
	return editor_store((state) => state.author_ids);
}

export function useEditorImageData(): EditorJSImageData[] {
	return editor_store((state) => state.image_data);
}
