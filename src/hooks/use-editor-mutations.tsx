"use client";

import { get_published_article_link } from "~/lib/article-utils";
import { api } from "~/trpc/react";
import {
  update_article_from_editor,
  validate_article,
} from "../components/editor/editor-lib";
import { useDuplicatedUrls } from "~/hooks/use-duplicated-urls";
import { useContext } from "react";
import { DraftArticleContext } from "../components/article/context";
import { EditorContext } from "../components/editor/editor-context";
import { useRouter } from "next/navigation";
import { useToast } from "~/hooks/use-toast";
import { editor_store } from "~/components/editor/editor-store";
import type {
  PublishArticleSchema,
  SaveDraftArticleSchema,
} from "~/server/db/schema";
import type { z } from "zod";
import type { CropType } from "~/lib/validators";

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
    save_draft: async (created_at?: Date, thumbnail_crop?: CropType) => {
      editor_context.setSavingText("Shranjujem osnutek ...");
      const editor_content = await editor_context.editor?.save();
      if (!editor_content) return;

      const updated = validate_article(editor_content, toaster);

      const state = editor_store.get.state();
      const article = {
        title: updated?.title ?? state.title,
        created_at: created_at ?? draft_article.created_at,
        content: editor_content,
        thumbnail_crop: thumbnail_crop ?? state.thumbnail_crop,
      } satisfies z.infer<typeof SaveDraftArticleSchema>;

      update_article_from_editor(
        true,
        {
          ...article,
          url: updated?.url ?? "",
        },
        draft_article.id,
      );

      console.log("editor mutation save_draft", {
        draft_article,
        article,
        state,
      });

      save_draft.mutate({
        draft_id: draft_article.id,
        article,
        author_ids: state.author_ids,
      });
    },
    publish: async (created_at?: Date, thumbnail_crop?: CropType) => {
      editor_context.setSavingText("Objavljam spremembe ...");
      const editor_content = await editor_context.editor?.save();
      if (!editor_content) return;

      const updated = validate_article(editor_content, toaster);
      if (!updated) return;

      const state = editor_store.get.state();
      const article = {
        title: updated.title,
        url: updated.url,
        created_at: created_at ?? draft_article.created_at,
        content: editor_content,
        thumbnail_crop: thumbnail_crop ?? state.thumbnail_crop,
      } satisfies z.infer<typeof PublishArticleSchema>;

      update_article_from_editor(false, article, draft_article.id);

      publish.mutate({
        draft_id: draft_article.id,
        article,
        author_ids: state.author_ids,
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
