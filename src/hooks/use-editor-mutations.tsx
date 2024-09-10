"use client";

import { get_published_article_link } from "~/lib/article-utils";
import { api } from "~/trpc/react";
import {
  update_article_before_publish,
  update_article_before_save,
} from "../components/editor/editor-lib";
import { useDuplicatedUrls } from "~/hooks/use-duplicated-urls";
import { useContext } from "react";
import { DraftArticleContext } from "../components/article/context";
import { EditorContext } from "../components/editor/editor-context";
import { useRouter } from "next/navigation";
import { useToast } from "~/hooks/use-toast";
import { merge_objects } from "~/lib/merge-objects";

export function useEditorMutations() {
  const draft_article = useContext(DraftArticleContext);
  const editor_context = useContext(EditorContext);
  const duplicate_urls = useDuplicatedUrls();
  const trpc_utils = api.useUtils();

  const toaster = useToast();
  const router = useRouter();

  if (!draft_article || !editor_context) {
    throw new Error("Missing context");
  }

  const save_draft = api.article.save_draft.useMutation({
    onSuccess: async () => {
      editor_context.setSavingText(undefined);
      editor_context.setDirty(false);
      await trpc_utils.article.invalidate();
    },
  });

  const publish = api.article.publish.useMutation({
    onSuccess: async (data) => {
      editor_context.setSavingText(undefined);
      editor_context.setDirty(false);

      await trpc_utils.article.invalidate();
      router.push(
        get_published_article_link(data.url, data.created_at, duplicate_urls),
      );
    },
  });

  const delete_draft = api.article.delete_draft.useMutation({
    onSuccess: async (data) => {
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

  const unpublish = api.article.unpublish.useMutation({
    onSuccess: async () => {
      await trpc_utils.article.invalidate();
      editor_context.setSavingText(undefined);
    },
  });

  const delete_both = api.article.delete_both.useMutation({
    onSuccess: async () => {
      /* const returned_data = data.at(0);
      if (!returned_data) return;

      await delete_algolia_article(returned_data.id.toString());
      await delete_s3_directory(`${returned_data.url}-${returned_data.id}`);
      await trpc_utils.article.invalidate(); */

      await trpc_utils.article.invalidate();
      router.replace(`/`);
    },
  });

  return {
    save_draft: async (created_at?: Date, image?: string | undefined) => {
      editor_context.setSavingText("Shranjujem osnutek ...");
      const editor_content = await editor_context.editor?.save();
      if (!editor_content) return;

      update_article_before_save(draft_article, editor_content);

      const article = {
        ...draft_article,
        content: editor_content,
      };

      save_draft.mutate({
        draft_id: draft_article.id,
        article: merge_objects(article, { created_at, image }),
        author_ids: draft_article.draft_articles_to_authors.map(
          (a) => a.author_id,
        ),
      });
    },
    publish: async (created_at?: Date, image?: string | undefined) => {
      editor_context.setSavingText("Objavljam spremembe ...");
      const editor_content = await editor_context.editor?.save();
      if (!editor_content) return;

      const updated = update_article_before_publish(
        draft_article,
        editor_content,
        toaster,
      );

      if (!updated) return;

      const article = {
        ...draft_article,
        ...updated,
        content: editor_content,
      };

      publish.mutate({
        draft_id: draft_article.id,
        article: merge_objects(article, { created_at, image }),
        author_ids: draft_article.draft_articles_to_authors.map(
          (a) => a.author_id,
        ),
      });
    },
    delete_draft: () => {
      editor_context.setSavingText("Brišem osnutek...");
      delete_draft.mutate(draft_article.id);
    },
    unpublish: () => {
      editor_context.setSavingText("Skrivam novičko ...");
      unpublish.mutate(draft_article.id);
    },
    delete_both: () => {
      editor_context.setSavingText("Brišem novičko ...");
      delete_both.mutate(draft_article.id);
    },
  };
}
