import { createStore } from "zustand-x";
import type { EditorJSImageData } from "../../lib/editor-utils";

interface EditorStoreType {
  id: number;
  title: string;
  url: string;
  image: string | undefined;
  image_data: EditorJSImageData[];
  author_ids: number[];
}

const initial_data = {
  id: -1,
  title: "",
  url: "",
  image: undefined,
  image_data: [],
  author_ids: [],
} satisfies EditorStoreType;

export const editor_store = createStore("editor")<EditorStoreType>(
  initial_data,
).extendActions((set) => ({
  reset: () =>
    set.state((draft) => {
      draft.id = initial_data.id;
      draft.title = initial_data.title;
      draft.url = initial_data.url;
      draft.image = initial_data.image;
      draft.image_data = initial_data.image_data;
      draft.author_ids = initial_data.author_ids;
    }),
}));
