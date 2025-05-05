import { create } from "zustand";
import { produce } from "immer";
import type { EditorJSImageData } from "~/lib/editor-utils";

export interface GalleryStoreType {
  images: EditorJSImageData[];
  default_image: EditorJSImageData | undefined;
  add_image: (image: EditorJSImageData) => void;
}

export const gallery_store = create<GalleryStoreType>()((set) => ({
  images: [],
  default_image: undefined,
  add_image: (image: EditorJSImageData) => {
    set(
      produce((state: GalleryStoreType) => {
        state.images.push(image);
      }),
    );
  },
}));
