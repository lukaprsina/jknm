import {
  get_heading_from_editor,
  get_image_data_from_editor,
} from "~/lib/editor-utils";
import type { DraftArticleWithAuthors } from "../article/card-adapter";
import type { OutputData } from "@editorjs/editorjs";
import { editor_store } from "./editor-store";
import type { useToast } from "~/hooks/use-toast";
import { NoHeadingButton, WrongHeadingButton } from "./error-buttons";
import { convert_title_to_url } from "~/lib/article-utils";
import { env } from "~/env";

export function update_settings_from_editor(
  article: DraftArticleWithAuthors,
  editor_content: OutputData,
  title?: string,
) {
  const image_data = get_image_data_from_editor(editor_content);
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
    draft.id = article.id;
    draft.image_data = image_data;
    if (typeof title !== "undefined") {
      draft.title = title;
      draft.url = convert_title_to_url(title);
    }

    draft.author_ids = article.draft_articles_to_authors.map(
      (a) => a.author_id,
    );
  });
}

export function update_article_before_save(
  article: DraftArticleWithAuthors,
  editor_content: OutputData,
) {
  const new_url = article.id.toString();
  update_article(true, article, editor_content, new_url);
}

export function update_article_before_publish(
  article: DraftArticleWithAuthors,
  editor_content: OutputData,
  toast: ReturnType<typeof useToast>,
) {
  const { title, error } = get_heading_from_editor(editor_content);

  if (error === "NO_HEADING") {
    toast.toast({
      title: "Naslov ni nastavljen",
      description: "Prva vrstica mora biti H1 naslov.",
      action: <NoHeadingButton />,
    });
  } else if (error === "WRONG_HEADING_LEVEL") {
    toast.toast({
      title: "Naslov ni pravilne ravni",
      description: "Prva vrstica mora biti H1 naslov.",
      action: <WrongHeadingButton title={title} />,
    });
  }

  if (!title) return;

  const url = convert_title_to_url(title);
  update_article(false, article, editor_content, url, title);

  return { title, url };
}

function update_article(
  draft: boolean,
  article: DraftArticleWithAuthors,
  editor_content: OutputData,
  updated_url: string,
  updated_title?: string,
) {
  const hostname = draft
    ? env.AWS_DRAFT_BUCKET_NAME
    : env.AWS_PUBLISHED_BUCKET_NAME;
  rename_urls_in_editor(hostname, editor_content, updated_url);

  update_settings_from_editor(article, editor_content, updated_title);

  const image = editor_store.get.image();

  const new_image = image
    ? rename_url(hostname, image, updated_url)
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
