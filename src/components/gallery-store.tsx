import { createStore } from "zustand-x";
import type { EditorJSImageData } from "~/lib/editor-utils";

export interface GalleryStoreType {
	images: EditorJSImageData[];
	default_image: EditorJSImageData | undefined;
}

const initial_data = {
	images: [],
	default_image: undefined,
} satisfies GalleryStoreType;

export const gallery_store = createStore<GalleryStoreType>(initial_data, {
	name: "gallery",
}).extendActions(({ set, get }) => ({
	add_image: (image: EditorJSImageData) => {
		const images = get("images");
		if (images.some((existing) => existing.file.url === image.file.url)) return;
		set("images", images.concat(image));
	},
}));
