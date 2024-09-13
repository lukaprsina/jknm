"use client";

import {
  get_published_article_link,
  get_s3_draft_directory,
  get_s3_published_directory,
} from "~/lib/article-utils";
import { api } from "~/trpc/react";
import {
  update_settings_from_editor,
  // update_article_from_editor,
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
import type { ThumbnailType } from "~/lib/validators";
import { upload_image_by_url } from "~/components/aws-s3/upload-file";

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
    onSettled: async () => {
      editor_context.setSavingText(undefined);
      editor_context.setDirty(false);
      await trpc_utils.article.invalidate();
      await trpc_utils.article.get_infinite_published.invalidate();
    },
    onError: (error) => {
      toaster.toast({
        title: "Napaka pri shranjevanju osnutka",
        description: error.message,
      });
    },
  });

  const publish = api.article.publish.useMutation({
    onSuccess: (data) => {
      router.push(
        get_published_article_link(data.url, data.created_at, duplicate_urls),
      );
    },
    onSettled: async () => {
      editor_context.setSavingText(undefined);
      editor_context.setDirty(false);
      await trpc_utils.article.invalidate();
      await trpc_utils.article.get_infinite_published.invalidate();
    },
    onError: (error) => {
      toaster.toast({
        title: "Napaka pri objavljanju novičke",
        description: error.message,
      });
    },
  });

  const delete_draft = api.article.delete_draft.useMutation({
    onSuccess: (data) => {
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
    onSettled: async () => {
      editor_context.setSavingText(undefined);
      await trpc_utils.article.invalidate();
      await trpc_utils.article.get_infinite_published.invalidate();
    },
    onError: (error) => {
      toaster.toast({
        title: "Napaka pri brisanju osnutka",
        description: error.message,
      });
    },
  });

  const unpublish = api.article.unpublish.useMutation({
    onSettled: async () => {
      editor_context.setSavingText(undefined);
      await trpc_utils.article.invalidate();
      await trpc_utils.article.get_infinite_published.invalidate();
    },
    onError: (error) => {
      toaster.toast({
        title: "Napaka pri skrivanju novičke",
        description: error.message,
      });
    },
  });

  const delete_both = api.article.delete_both.useMutation({
    onSettled: async () => {
      router.replace(`/`);
      await trpc_utils.article.invalidate();
      await trpc_utils.article.get_infinite_published.invalidate();
    },
    onError: (error) => {
      toaster.toast({
        title: "Napaka pri brisanju novičke",
        description: error.message,
      });
    },
  });

  return {
    save_draft: async (created_at?: Date, thumbnail_crop?: ThumbnailType) => {
      editor_context.setSavingText("Shranjujem osnutek ...");
      const editor_content = await editor_context.editor?.save();
      if (!editor_content) return;

      if (thumbnail_crop) {
        await upload_image_by_url({
          url: thumbnail_crop.image_url,
          custom_title: "thumbnail.png",
          crop: thumbnail_crop,
          allow_overwrite: "allow_overwrite",
          draft: true,
          directory: get_s3_draft_directory(draft_article.id),
        });
      }

      const updated = validate_article(editor_content, toaster);

      const state = editor_store.get.state();
      const article = {
        title: updated?.title ?? state.title,
        created_at: created_at ?? draft_article.created_at,
        content: editor_content,
        thumbnail_crop: thumbnail_crop ?? state.thumbnail_crop,
      } satisfies z.infer<typeof SaveDraftArticleSchema>;

      update_settings_from_editor({
        title: updated?.title ?? "",
        url: updated?.url ?? "",
        s3_url: get_s3_draft_directory(draft_article.id),
        thumbnail_crop: article.thumbnail_crop,
        editor_content,
        article_id: draft_article.id,
        author_ids: draft_article.draft_articles_to_authors.map(
          (a) => a.author_id,
        ),
      });

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
    publish: async (fake_created_at?: Date, thumbnail_crop?: ThumbnailType) => {
      editor_context.setSavingText("Objavljam spremembe ...");
      const editor_content = await editor_context.editor?.save();
      if (!editor_content) return;

      const updated = validate_article(editor_content, toaster);
      if (!updated) return;

      const created_at = fake_created_at ?? draft_article.created_at;

      if (thumbnail_crop) {
        await upload_image_by_url({
          url: thumbnail_crop.image_url,
          custom_title: "thumbnail.png",
          crop: thumbnail_crop,
          allow_overwrite: "allow_overwrite",
          draft: false,
          directory: get_s3_published_directory(updated.url, created_at),
        });
      }

      const state = editor_store.get.state();
      const article = {
        title: updated.title,
        url: updated.url,
        created_at,
        content: editor_content,
        thumbnail_crop: thumbnail_crop ?? state.thumbnail_crop,
      } satisfies z.infer<typeof PublishArticleSchema>;

      update_settings_from_editor({
        title: updated.title,
        url: updated.url,
        s3_url: get_s3_draft_directory(draft_article.id),
        thumbnail_crop: article.thumbnail_crop,
        editor_content,
        article_id: draft_article.id,
        author_ids: draft_article.draft_articles_to_authors.map(
          (a) => a.author_id,
        ),
      });

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
