import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EditorJSImageData } from "~/lib/editor-utils";
import type { ThumbnailType } from "~/lib/validators";

interface EditorStoreType {
  draft_id: number;
  title: string;
  url: string;
  s3_url: string;
  thumbnail_crop: ThumbnailType | null;
  image_data: EditorJSImageData[];
  author_ids: number[];
  reset: () => void;
}

// Define initial_data for default state
const initial_data: Omit<EditorStoreType, "reset"> = {
  draft_id: -1,
  title: "",
  url: "",
  s3_url: "",
  thumbnail_crop: null,
  image_data: [],
  author_ids: [],
};

export const editor_store = create<EditorStoreType>()(
  persist(
    (set) => ({
      ...initial_data,
      reset: () => set(() => ({ ...initial_data })),
    }),
    { name: "editor" },
  ),
);
