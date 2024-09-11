import {
  get_heading_from_editor,
  get_image_data_from_editor,
} from "~/lib/editor-utils";
import type { OutputData } from "@editorjs/editorjs";
import { editor_store } from "./editor-store";
import type { useToast } from "~/hooks/use-toast";
import { NoHeadingButton, WrongHeadingButton } from "./error-buttons";
import { convert_title_to_url } from "~/lib/article-utils";
import type { PublishArticleSchema } from "~/server/db/schema";
import type { z } from "zod";
import type { CropType } from "~/lib/validators";
import { get_s3_url } from "~/lib/get-s3-url";
import { format_date_for_url } from "~/lib/format-date";

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
  thumbnail_crop: CropType;
  editor_content: OutputData;
  article_id: number;
  author_ids?: number[];
}) {
  const image_data = get_image_data_from_editor(editor_content);
  const store_crop = editor_store.get.thumbnail_crop();

  editor_store.set.state((draft) => {
    if (!store_crop && thumbnail_crop) {
      draft.thumbnail_crop = thumbnail_crop;
    }

    draft.draft_id = article_id;
    draft.image_data = image_data;
    draft.title = title;
    draft.url = url;
    draft.s3_url = s3_url;
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

export function update_article_from_editor(
  article: z.infer<typeof PublishArticleSchema>,
  draft: boolean,
) {
  if (!article.content || !article.created_at) return;

  let s3_url: string | undefined = undefined;

  const store_draft_id = editor_store.get.draft_id();
  if (!store_draft_id) {
    throw new Error("Article ID is missing");
  }

  if (draft) {
    s3_url = store_draft_id.toString();
  } else {
    s3_url = `${article.url}-${format_date_for_url(article.created_at)}`;
  }

  rename_urls_in_editor(article.content, s3_url, draft);

  update_settings_from_editor({
    title: article.title,
    url: article.url,
    s3_url,
    thumbnail_crop: article.thumbnail_crop ?? null,
    editor_content: article.content,
    article_id: store_draft_id,
  });

  const thumbnail = editor_store.get.thumbnail_crop();

  if (thumbnail) {
    const fake_url = get_s3_url("thumbnail.png", draft);
    rename_url(fake_url, s3_url, draft);
  }
}

export function rename_urls_in_editor(
  editor_content: OutputData,
  article_url: string,
  draft: boolean,
) {
  console.log("Renaming files in editor", { editor_content, article_url });

  for (const block of editor_content.blocks) {
    if (!block.id || !["image", "attaches"].includes(block.type)) {
      continue;
    }

    const file_data = block.data as { file: { url: string } };
    const new_url = rename_url(file_data.file.url, article_url, draft);
    // console.log("Renamed file", { old_url: file_data.file.url, new_url });
    file_data.file.url = new_url;
  }
}

export function rename_url(
  old_url: string,
  article_url: string,
  draft: boolean,
) {
  const url_parts = new URL(old_url);
  const file_name = url_parts.pathname.split("/").pop();

  if (!file_name) {
    console.error("No name in URL", old_url);
    return old_url;
  }

  const new_url = get_s3_url(`${article_url}/${file_name}`, draft);
  return new_url;
}
