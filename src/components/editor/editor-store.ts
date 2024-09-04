import { createStore } from "zustand-x";
import { EditorJSImageData } from "./plugins";

interface EditorStoreType {
  id: number;
  title: string;
  url: string;
  preview_image: string | undefined;
  image_data: EditorJSImageData[];
  google_ids: string[];
  custom_author_names: string[];
}

export const editor_store = createStore("editor")<EditorStoreType>({
  id: -1,
  title: "",
  url: "",
  preview_image: undefined,
  image_data: [],
  google_ids: [],
  custom_author_names: [],
});
