import {
  get_heading_from_editor,
  get_image_data_from_editor,
} from "~/lib/editor-utils";
import type { OutputData } from "@editorjs/editorjs";
import { editor_store } from "./editor-store";
import type { useToast } from "~/hooks/use-toast";
import { NoHeadingButton, WrongHeadingButton } from "./error-buttons";
import { convert_title_to_url } from "~/lib/article-utils";
import type { ThumbnailType } from "~/lib/validators";

export function update_settings_from_editor({
  title,
  url,
  s3_url,
  thumbnail_crop,
  editor_content,
  article_id,
  author_ids,
}: {
  title: string;
  url: string;
  s3_url: string;
  thumbnail_crop: ThumbnailType | null;
  editor_content: OutputData;
  article_id: number;
  author_ids?: number[];
}) {
  const image_data = get_image_data_from_editor(editor_content);
  // const store_crop = editor_store.get.thumbnail_crop();
  /* console.log("update_settings_from_editor", {
    title,
    url,
    s3_url,
    thumbnail_crop,
    editor_content,
    article_id,
    author_ids,
  }); */

  editor_store.set.state((draft) => {
    draft.draft_id = article_id;
    draft.image_data = image_data;
    draft.title = title;
    draft.url = url;
    draft.s3_url = s3_url;

    if (thumbnail_crop) draft.thumbnail_crop = thumbnail_crop;
    if (author_ids) draft.author_ids = author_ids;
  });
}

export function validate_article(
  editor_content: OutputData,
  toaster: ReturnType<typeof useToast>,
) {
  const { title: updated_title, error } =
    get_heading_from_editor(editor_content);

  if (error === "NO_HEADING") {
    toaster.toast({
      title: "Naslov ni nastavljen",
      description: "Prva vrstica mora biti H1 naslov.",
      action: <NoHeadingButton />,
    });
  } else if (error === "WRONG_HEADING_LEVEL") {
    toaster.toast({
      title: "Naslov ni pravilne ravni",
      description: "Prva vrstica mora biti H1 naslov.",
      action: <WrongHeadingButton title={updated_title} />,
    });
  }

  if (!updated_title) return;

  const updated_url = convert_title_to_url(updated_title);

  return { title: updated_title, url: updated_url };
}
