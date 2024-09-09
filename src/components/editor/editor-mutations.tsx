"use client";

import { get_published_article_link } from "~/lib/article-utils";
import { content_to_text } from "~/lib/content-to-text";
import { api } from "~/trpc/react";
import { update_settings_from_editor } from "./editor-lib";
import { useDuplicatedUrls } from "~/hooks/use-duplicated-urls";
import { useContext } from "react";
import { DraftArticleContext } from "../article/context";
import { EditorContext } from "./editor-context";
import { useRouter } from "next/navigation";

export function useEditorMutations() {
  const article_context = useContext(DraftArticleContext);
  const editor_context = useContext(EditorContext);
  const trpc_utils = api.useUtils();
  const duplicate_urls = useDuplicatedUrls();
  const router = useRouter();

  if (!article_context || !editor_context) {
    throw new Error("Missing context");
  }

  const save_draft = api.article.save_draft.useMutation({
    onMutate: () => {
      editor_context.setSavingText("Shranjujem osnutek ...");
    },
    onSuccess: async () => {
      if (!editor_context.editor) return;
      const editor_content = await editor_context.editor.save();

      update_settings_from_editor(article_context, editor_content);

      editor_context.setSavingText(undefined);
      editor_context.setDirty(false);

      await trpc_utils.article.invalidate();
    },
  });

  const delete_draft = api.article.delete_draft.useMutation({
    onMutate: () => {
      editor_context.setSavingText("Brišem osnutek ...");
    },
    onSuccess: async (data) => {
      if (!editor_context.editor) return;

      editor_context.setSavingText(undefined);

      await trpc_utils.article.invalidate();

      if (data.url) {
        router.push(
          get_published_article_link(
            data.url,
            data.draft.created_at,
            duplicate_urls,
          ),
        );
      }
    },
  });

  const publish = api.article.publish.useMutation({
    onMutate: () => {
      editor_context.setSavingText("Objavljam spremembe ...");
    },
    onSuccess: async (data) => {
      const returned_data = data;
      if (!editor_context.editor || !returned_data) return;
      console.warn("published", returned_data);

      const content_preview = content_to_text(
        returned_data.content?.blocks ?? undefined,
      );

      if (!content_preview) {
        console.error("No content preview", returned_data);
      }

      editor_context.setSavingText(undefined);
      editor_context.setDirty(false);

      await trpc_utils.article.invalidate();

      if (data.url) {
        router.push(
          get_published_article_link(data.url, data.created_at, duplicate_urls),
        );
      }
    },
  });

  const unpublish = api.article.unpublish.useMutation({
    onMutate: () => {
      editor_context.setSavingText("Skrivam novičko ...");
    },
    onSuccess: async (data) => {
      const returned_data = data.at(0);
      if (!returned_data) return;

      editor_context.setSavingText(undefined);

      /* await update_algolia_article({
        objectID: returned_data.id.toString(),
        published: false,
        has_draft: true,
      }); */

      await trpc_utils.article.invalidate();
    },
  });

  const delete_both = api.article.delete_both.useMutation({
    onMutate: () => {
      editor_context.setSavingText("Brišem novičko ...");
    },
    // eslint-disable-next-line @typescript-eslint/require-await
    onSuccess: async (_data) => {
      /* const returned_data = data.at(0);
      if (!returned_data) return;

      await delete_algolia_article(returned_data.id.toString());
      await delete_s3_directory(`${returned_data.url}-${returned_data.id}`);
      await trpc_utils.article.invalidate(); */

      router.replace(`/`);
    },
  });

  return {
    save_draft,
    delete_draft,
    publish,
    unpublish,
    delete_both,
  };
}
