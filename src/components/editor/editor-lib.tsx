import {
  get_heading_from_editor,
  get_image_data_from_editor,
} from "~/lib/editor-utils";
import type { OutputData } from "@editorjs/editorjs";
import { editor_store } from "./editor-store";
import type { useToast } from "~/hooks/use-toast";
import { NoHeadingButton, WrongHeadingButton } from "./error-buttons";
import { convert_title_to_url } from "~/lib/article-utils";
import { env } from "~/env";
import type { PublishArticleSchema } from "~/server/db/schema";
import type { z } from "zod";

export function update_settings_from_editor(
  article: z.infer<typeof PublishArticleSchema>,
  article_id: number,
  author_ids: number[],
) {
  if (!article.content) return;

  const image_data = get_image_data_from_editor(article.content);
  const image = editor_store.get.image();

  editor_store.set.state((draft) => {
    if (!image) {
      if (article.image) {
        draft.image = article.image;
      } else {
        draft.image = image_data.at(0)?.file.url;
      }
    }

    draft.image_data = image_data;
    draft.id = article_id;
    draft.image_data = image_data;
    draft.title = article.title;
    draft.url = article.url;
    draft.author_ids = author_ids;
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
  draft: boolean,
  article: z.infer<typeof PublishArticleSchema>,
  article_id: number,
  author_ids: number[],
) {
  const hostname = draft
    ? env.NEXT_PUBLIC_S3_DRAFT_BUCKET_NAME
    : env.NEXT_PUBLIC_S3_PUBLISHED_BUCKET_NAME;

  if (!article.content) return;
  rename_urls_in_editor(hostname, article.content, article.url);

  update_settings_from_editor(article, article_id, author_ids);

  const image = editor_store.get.image();

  const new_image = image
    ? rename_url(hostname, image, article.url)
    : undefined;

  editor_store.set.image(new_image);
}

export function rename_urls_in_editor(
  hostname: string,
  editor_content: OutputData,
  new_dir: string,
) {
  console.log("Renaming files in editor", { editor_content, new_dir });

  for (const block of editor_content.blocks) {
    if (!block.id || !["image", "attaches"].includes(block.type)) {
      continue;
    }

    const file_data = block.data as { file: { url: string } };
    const new_url = rename_url(hostname, file_data.file.url, new_dir);
    console.log("Renamed file", { old_url: file_data.file.url, new_url });
    file_data.file.url = new_url;
  }
}

export function rename_url(hostname: string, old_url: string, new_dir: string) {
  const url_parts = new URL(old_url);
  const file_name = url_parts.pathname.split("/").pop();

  if (!file_name) {
    console.error("No name in URL", old_url);
    return old_url;
  }

  const new_url = `https://${hostname}/${new_dir}/${file_name}`;
  return new_url;
}
