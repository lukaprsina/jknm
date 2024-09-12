import { createStore } from "zustand-x";
import type { EditorJSImageData } from "../../lib/editor-utils";
import type { ThumbnailType } from "~/lib/validators";

interface EditorStoreType {
  draft_id: number;
  title: string;
  url: string;
  s3_url: string;
  thumbnail_crop: ThumbnailType;
  image_data: EditorJSImageData[];
  author_ids: number[];
}

const initial_data = {
  draft_id: -1,
  title: "",
  url: "",
  s3_url: "",
  thumbnail_crop: null,
  image_data: [],
  author_ids: [],
} satisfies EditorStoreType;

export const editor_store = createStore("editor")<EditorStoreType>(
  initial_data,
).extendActions((set) => ({
  reset: () =>
    set.state((draft) => {
      draft.draft_id = initial_data.draft_id;
      draft.title = initial_data.title;
      draft.url = initial_data.url;
      draft.s3_url = initial_data.s3_url;
      draft.thumbnail_crop = initial_data.thumbnail_crop;
      draft.image_data = initial_data.image_data;
      draft.author_ids = initial_data.author_ids;
    }),
}));
