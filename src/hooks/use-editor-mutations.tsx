/* eslint-disable @typescript-eslint/require-await */
"use client";

import {
  get_published_article_link,
  get_s3_draft_directory,
} from "~/lib/article-utils";
import {
  update_settings_from_editor,
  validate_article,
} from "~/components/editor/editor-lib";
import { useContext } from "react";
import {
  DraftArticleContext,
  PublishedArticleContext,
} from "~/components/article/context";
import { EditorContext } from "~/components/editor/editor-context";
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
import { cached_state_store } from "~/app/provider";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { save_draft } from "~/server/article/save-draft";
import { publish } from "~/server/article/publish";
import { delete_both, delete_draft } from "~/server/article/delete";
import { unpublish } from "~/server/article/unpublish";
import type {
  delete_both_validator,
  delete_draft_validator,
  publish_validator,
  save_draft_validator,
  unpublish_validator,
} from "~/server/article/validators";

export function useEditorMutations() {
  const query_client = useQueryClient();
  const draft_article = useContext(DraftArticleContext);
  const publish_article = useContext(PublishedArticleContext);
  const editor_context = useContext(EditorContext);
  const duplicate_urls = cached_state_store.get.duplicate_urls();

  const toaster = useToast();
  const router = useRouter();

  if (!draft_article || !editor_context) {
    throw new Error("Missing context");
  }

  /* const sync_duplicate_urls = api.article.sync_duplicate_urls.useMutation({
    onError: (error) => {
      toaster.toast({
        title: "Napaka pri sinhronizaciji URL-jev",
        description: error.message,
      });
    },
  }); */

  const save_draft_mutation = useMutation({
    mutationFn: (input: z.infer<typeof save_draft_validator>) =>
      save_draft(input),
    onSettled: async () => {
      editor_context.setSavingText(undefined);
      editor_context.setDirty(false);

      /* await trpc_utils.article.invalidate();
      await trpc_utils.article.get_infinite_published.invalidate(); */
    },
    onError: (error) => {
      toaster.toast({
        title: "Napaka pri shranjevanju osnutka",
        description: error.message,
      });
    },
  });

  const publish_mutation = useMutation({
    mutationFn: (input: z.infer<typeof publish_validator>) => publish(input),
    onSuccess: (data) => {
      // sync_duplicate_urls.mutate();
      router.push(
        get_published_article_link(data.url, data.created_at, duplicate_urls),
      );
    },
    onSettled: async () => {
      editor_context.setSavingText(undefined);
      editor_context.setDirty(false);

      await query_client.invalidateQueries({
        queryKey: ["infinite_published"],
      });
      /* await trpc_utils.article.invalidate();
      await trpc_utils.article.get_duplicate_urls.invalidate();
      await trpc_utils.article.get_infinite_published.invalidate(); */
    },
    onError: (error) => {
      toaster.toast({
        title: "Napaka pri objavljanju novičke",
        description: error.message,
      });
    },
  });

  const delete_draft_mutation = useMutation({
    mutationFn: (input: z.infer<typeof delete_draft_validator>) =>
      delete_draft(input),
    onSuccess: (data) => {
      if (data.url) {
        router.push(
          get_published_article_link(
            data.url,
            data.draft.created_at,
            duplicate_urls,
          ),
        );
      } else {
        router.push(`/`);
      }
    },
    onSettled: async () => {
      editor_context.setSavingText(undefined);
      await query_client.invalidateQueries({
        queryKey: ["infinite_published"],
      });
      /* await trpc_utils.article.invalidate();
      await trpc_utils.article.get_infinite_published.invalidate(); */
    },
    onError: (error) => {
      toaster.toast({
        title: "Napaka pri brisanju osnutka",
        description: error.message,
      });
    },
  });

  const unpublish_mutation = useMutation({
    mutationFn: (input: z.infer<typeof unpublish_validator>) =>
      unpublish(input),
    onSettled: async () => {
      editor_context.setSavingText(undefined);
      await query_client.invalidateQueries({
        queryKey: ["infinite_published"],
      });
      /* await trpc_utils.article.invalidate();
      await trpc_utils.article.get_infinite_published.invalidate(); */
      router.refresh();
    },
    onError: (error) => {
      toaster.toast({
        title: "Napaka pri skrivanju novičke",
        description: error.message,
      });
    },
  });

  const delete_both_mutation = useMutation({
    mutationFn: (input: z.infer<typeof delete_both_validator>) =>
      delete_both(input),
    onSettled: async () => {
      await query_client.invalidateQueries({
        queryKey: ["infinite_published"],
      });
      /* await trpc_utils.article.invalidate();
      await trpc_utils.article.get_infinite_published.invalidate(); */
      router.replace(`/`);
    },
    onError: (error) => {
      toaster.toast({
        title: "Napaka pri brisanju novičke",
        description: error.message,
      });
    },
  });

  return {
    save_draft: async (
      fake_created_at?: Date,
      thumbnail_crop?: ThumbnailType,
    ) => {
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
      const created_at = fake_created_at ?? draft_article.created_at;

      const state = editor_store.get.state();
      const article = {
        title: updated?.title ?? state.title,
        created_at,
        content: editor_content,
        thumbnail_crop: thumbnail_crop ?? state.thumbnail_crop,
      } satisfies z.infer<typeof SaveDraftArticleSchema>;

      update_settings_from_editor({
        title: updated?.title ?? "",
        url: updated?.url ?? "",
        s3_url: get_s3_draft_directory(draft_article.id),
        thumbnail_crop: thumbnail_crop ?? state.thumbnail_crop,
        editor_content,
        article_id: draft_article.id,
        /* author_ids: draft_article.draft_articles_to_authors.map(
          (a) => a.author_id,
        ), */
      });

      /* console.log("editor mutation save_draft", {
        draft_article,
        draft_article,
        state,
      }); */

      save_draft_mutation.mutate({
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
          draft: true,
          directory: get_s3_draft_directory(draft_article.id),
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

      publish_mutation.mutate({
        draft_id: draft_article.id,
        article,
        author_ids: state.author_ids,
      });
    },
    delete_draft: () => {
      editor_context.setSavingText("Brišem osnutek...");
      delete_draft_mutation.mutate({ draft_id: draft_article.id });
    },
    unpublish: () => {
      if (!publish_article) {
        return;
      }

      editor_context.setSavingText("Skrivam novičko ...");
      unpublish_mutation.mutate({ published_id: publish_article.id });
    },
    delete_both: () => {
      editor_context.setSavingText("Brišem novičko ...");
      delete_both_mutation.mutate({ draft_id: draft_article.id });
    },
  };
}
