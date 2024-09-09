"use client";

import { get_published_article_link } from "~/lib/article-utils";
import { api } from "~/trpc/react";
import {
  update_article_before_publish,
  update_article_before_save,
} from "./editor-lib";
import { useDuplicatedUrls } from "~/hooks/use-duplicated-urls";
import { useContext } from "react";
import { DraftArticleContext } from "../article/context";
import { EditorContext } from "./editor-context";
import { useRouter } from "next/navigation";
import { useToast } from "~/hooks/use-toast";

export function useEditorMutations() {
  const draft_article = useContext(DraftArticleContext);
  const editor_context = useContext(EditorContext);
  const duplicate_urls = useDuplicatedUrls();

  const toaster = useToast();
  const router = useRouter();

  if (!draft_article || !editor_context) {
    throw new Error("Missing context");
  }

  const save_draft = api.article.save_draft.useMutation({
    onSuccess: () => {
      //   TODO
      /* if (!editor_context.editor) return;
      const editor_content = await editor_context.editor.save();

      update_settings_from_editor(draft_article, editor_content); */

      editor_context.setSavingText(undefined);
      editor_context.setDirty(false);

      //   await trpc_utils.article.invalidate();
    },
  });

  const publish = api.article.publish.useMutation({
    onSuccess: (data) => {
      // TODO: throw error
      if (!data) return;
      /* const returned_data = data;
      if (!editor_context.editor || !returned_data) return;
      console.warn("published", returned_data);

      const content_preview = content_to_text(
        returned_data.content?.blocks ?? undefined,
      );

      if (!content_preview) {
        console.error("No content preview", returned_data);
      } */

      editor_context.setSavingText(undefined);
      editor_context.setDirty(false);

      //   await trpc_utils.article.invalidate();

      router.push(
        get_published_article_link(data.url, data.created_at, duplicate_urls),
      );
    },
  });

  const delete_draft = api.article.delete_draft.useMutation({
    onMutate: () => {
      editor_context.setSavingText("Brišem osnutek ...");
    },
    onSuccess: (data) => {
      if (!editor_context.editor) return;

      editor_context.setSavingText(undefined);

      //   await trpc_utils.article.invalidate();

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

  const unpublish = api.article.unpublish.useMutation({
    onMutate: () => {
      editor_context.setSavingText("Skrivam novičko ...");
    },
    onSuccess: () => {
      editor_context.setSavingText(undefined);

      //   await trpc_utils.article.invalidate();
    },
  });

  const delete_both = api.article.delete_both.useMutation({
    onMutate: () => {
      editor_context.setSavingText("Brišem novičko ...");
    },
    onSuccess: (_data) => {
      /* const returned_data = data.at(0);
      if (!returned_data) return;

      await delete_algolia_article(returned_data.id.toString());
      await delete_s3_directory(`${returned_data.url}-${returned_data.id}`);
      await trpc_utils.article.invalidate(); */

      router.replace(`/`);
    },
  });

  return {
    save_draft: async () => {
      editor_context.setSavingText("Shranjujem osnutek ...");
      const editor_content = await editor_context.editor?.save();
      if (!editor_content) return;

      update_article_before_save(draft_article, editor_content);

      save_draft.mutate({
        draft_id: draft_article.id,
        article: {
          ...draft_article,
          content: editor_content,
        },
        author_ids: draft_article.draft_articles_to_authors.map(
          (a) => a.author_id,
        ),
      });
    },
    publish: async () => {
      editor_context.setSavingText("Objavljam spremembe ...");
      const editor_content = await editor_context.editor?.save();
      if (!editor_content) return;

      const updated = update_article_before_publish(
        draft_article,
        editor_content,
        toaster,
      );

      if (!updated) return;

      publish.mutate({
        draft_id: draft_article.id,
        article: {
          ...draft_article,
          ...updated,
          content: editor_content,
        },
        author_ids: draft_article.draft_articles_to_authors.map(
          (a) => a.author_id,
        ),
      });
    },
    delete_draft,
    unpublish,
    delete_both,
  };
}