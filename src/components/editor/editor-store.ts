import { createStore } from "zustand-x";
import type { ThumbnailType } from "~/lib/validators";
import type { EditorJSImageData } from "../../lib/editor-utils";

interface EditorStoreType {
	draft_id: string;
	title: string;
	url: string;
	s3_url: string;
	thumbnail_crop: ThumbnailType | null;
	image_data: EditorJSImageData[];
	author_ids: number[];
}

const initial_data = {
	draft_id: "",
	title: "",
	url: "",
	s3_url: "",
	thumbnail_crop: null,
	image_data: [],
	author_ids: [],
} satisfies EditorStoreType;

export const editor_store = createStore<EditorStoreType>(initial_data, {
	name: "editor",
});
