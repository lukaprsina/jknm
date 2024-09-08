import { get_image_data_from_editor } from "~/lib/editor-utils";
import type { DraftArticleWithAuthors } from "../article/card-adapter";
import type { OutputData } from "@editorjs/editorjs";
import { editor_store } from "./editor-store";

export function update_settings_from_editor(
  article: DraftArticleWithAuthors,
  editor_content: OutputData,
  title?: string,
) {
  const image_data = get_image_data_from_editor(editor_content);
  const preview_image = editor_store.get.preview_image();

  editor_store.set.state((draft) => {
    if (!preview_image) {
      if (article.preview_image) {
        draft.preview_image = article.preview_image;
      } else {
        draft.preview_image = image_data.at(0)?.file.url;
      }
    }

    draft.image_data = image_data;
    draft.id = article.id;
    draft.image_data = image_data;
    if (typeof title !== "undefined") draft.title = title;
    //  if (typeof url !== "undefined") draft.url = url;

    // TODO
    // draft.google_ids = article.author_ids ?? [];
    // draft.custom_author_names = article.custom_author_names ?? [];
  });
}

export function rename_files_in_editor(
  editor_content: OutputData,
  new_dir: string,
) {
  console.log("Renaming files in editor", { editor_content, new_dir });

  for (const block of editor_content.blocks) {
    if (!block.id || !["image", "attaches"].includes(block.type)) {
      console.log("Skipping block", block.type);
      continue;
    }

    const file_data = block.data as { file: { url: string } };
    const new_url = rename_file(file_data.file.url, new_dir);
    console.log("Renamed file", { old_url: file_data.file.url, new_url });
    file_data.file.url = new_url;
  }
}

export function rename_file(old_url: string, new_dir: string) {
  const url_parts = new URL(old_url);
  const file_name = url_parts.pathname.split("/").pop();
  if (!file_name) {
    console.error("No name in URL", old_url);
    return old_url;
  }

  const new_url = `${url_parts.protocol}//${url_parts.hostname}/${new_dir}/${file_name}`;
  return new_url;
}

export const NO_CONTENT_EDITOR_VALUE = {
  time: Date.now(),
  blocks: [
    {
      id: "sheNwCUP5A",
      type: "header",
      data: {
        text: "Napaka: ne najdem vsebine",
        level: 1,
      },
    },
  ],
};
