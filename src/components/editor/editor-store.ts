import { createStore } from "zustand-x";
import type { EditorJSImageData } from "./editor-utils";

interface EditorStoreType {
  id: number;
  title: string;
  url: string;
  preview_image: string | undefined;
  image_data: EditorJSImageData[];
  google_ids: string[];
  custom_author_names: string[];
}

const initial_data = {
  id: -1,
  title: "",
  url: "",
  preview_image: undefined,
  image_data: [],
  google_ids: [],
  custom_author_names: [],
} satisfies EditorStoreType;

export const editor_store = createStore("editor")<EditorStoreType>(
  initial_data,
).extendActions((set) => ({
  reset: () =>
    set.state((draft) => {
      draft.id = initial_data.id;
      draft.title = initial_data.title;
      draft.url = initial_data.url;
      draft.preview_image = initial_data.preview_image;
      draft.image_data = initial_data.image_data;
      draft.google_ids = initial_data.google_ids;
      draft.custom_author_names = initial_data.custom_author_names;
    }),
}));
