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

export const gallery_store =
  createStore("gallery")<GalleryStoreType>(initial_data);
