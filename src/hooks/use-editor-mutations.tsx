"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useContext } from "react";
import {
	DraftArticleContext,
	PublishedArticleContext,
} from "~/components/article/context";
import { EditorContext } from "~/components/editor/editor-context";
import {
	update_settings_from_editor,
	validate_article,
} from "~/components/editor/editor-lib";
import { editor_store } from "~/components/editor/editor-store";
import { useToast } from "~/hooks/use-toast";
import { get_published_article_link } from "~/lib/article-utils";
import { apply_client_invalidations } from "~/lib/cache-invalidation-client";
import { unwrap_server_function } from "~/lib/orpc-action";
import type { ThumbnailType } from "~/lib/validators";
import {
	deleteArticle,
	discardDraft,
	publishArticle,
	saveArticle,
} from "~/server/orpc/article/procedures";

export function useEditorMutations() {
	const query_client = useQueryClient();
	const draft_article = useContext(DraftArticleContext);
	const published_article = useContext(PublishedArticleContext);
	const editor_context = useContext(EditorContext);

	const toaster = useToast();
	const router = useRouter();

	if (!draft_article || !editor_context) {
		throw new Error("Missing context");
	}

	const save_article_mutation = useMutation({
		mutationFn: (input: Parameters<typeof saveArticle>[0]) =>
			unwrap_server_function(saveArticle(input)),
		onSettled: () => {
			editor_context.setSavingText(undefined);
			editor_context.setDirty(false);
		},
		onError: (error) => {
			toaster.toast({
				title: "Napaka pri shranjevanju osnutka",
				description: error.message,
			});
		},
	});

	const publish_article_mutation = useMutation({
		mutationFn: (input: Parameters<typeof publishArticle>[0]) =>
			unwrap_server_function(publishArticle(input)),
		onSuccess: (data) => {
			router.push(`/novica/${data.slug}`);
		},
		onSettled: async () => {
			editor_context.setSavingText(undefined);
			editor_context.setDirty(false);
			await apply_client_invalidations(query_client, "article.published");
		},
		onError: (error) => {
			toaster.toast({
				title: "Napaka pri objavljanju novičke",
				description: error.message,
			});
		},
	});

	const delete_article_mutation = useMutation({
		mutationFn: (input: Parameters<typeof deleteArticle>[0]) =>
			unwrap_server_function(deleteArticle(input)),
		onSettled: async () => {
			await apply_client_invalidations(query_client, "article.deleted");
			router.replace(`/`);
		},
		onError: (error) => {
			toaster.toast({
				title: "Napaka pri brisanju novičke",
				description: error.message,
			});
		},
	});

	const discard_draft_mutation = useMutation({
		mutationFn: (input: Parameters<typeof discardDraft>[0]) =>
			unwrap_server_function(discardDraft(input)),
		onSettled: async () => {
			await apply_client_invalidations(query_client, "article.draft_discarded");
			// `url` is `""` when the source was archived straight from a draft
			// and never had a slug minted — fall back to `/` in that case too.
			router.replace(
				published_article?.url
					? get_published_article_link(published_article.url)
					: "/",
			);
		},
		onError: (error) => {
			toaster.toast({
				title: "Napaka pri zavračanju osnutka",
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

			const article_id = draft_article.id;

			const updated = validate_article(editor_content, toaster);
			const created_at = fake_created_at ?? draft_article.created_at;

			const state = editor_store.getState();
			const resolved_thumbnail_crop = thumbnail_crop ?? state.thumbnail_crop;

			update_settings_from_editor({
				title: updated?.title ?? "",
				url: updated?.url ?? "",
				s3_url: "",
				thumbnail_crop: resolved_thumbnail_crop,
				editor_content,
				article_id,
			});

			save_article_mutation.mutate({
				article_id,
				article: {
					title: updated?.title ?? state.title,
					created_at,
					content: editor_content,
					thumbnail_crop: resolved_thumbnail_crop ?? undefined,
				},
				author_ids: state.author_ids,
			});
		},
		publish: async (fake_created_at?: Date, thumbnail_crop?: ThumbnailType) => {
			editor_context.setSavingText("Objavljam spremembe ...");
			const editor_content = await editor_context.editor?.save();
			if (!editor_content) return;

			const updated = validate_article(editor_content, toaster);
			if (!updated) return;

			const article_id = draft_article.id;
			const created_at = fake_created_at ?? draft_article.created_at;

			const state = editor_store.getState();
			const resolved_thumbnail_crop = thumbnail_crop ?? state.thumbnail_crop;

			update_settings_from_editor({
				title: updated.title,
				url: updated.url,
				s3_url: "",
				thumbnail_crop: resolved_thumbnail_crop,
				editor_content,
				article_id,
				author_ids: draft_article.draft_articles_to_authors.map(
					(a) => a.author_id,
				),
			});

			publish_article_mutation.mutate({
				article_id,
				article: {
					title: updated.title,
					created_at,
					content: editor_content,
					thumbnail_crop: resolved_thumbnail_crop ?? undefined,
				},
				author_ids: state.author_ids,
			});
		},
		delete_article: () => {
			editor_context.setSavingText("Brišem novičko ...");
			delete_article_mutation.mutate({ article_id: draft_article.id });
		},
		discard_draft: () => {
			editor_context.setSavingText("Zavračam osnutek ...");
			discard_draft_mutation.mutate({ article_id: draft_article.id });
		},
	};
}
