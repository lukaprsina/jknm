"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useContext, useRef } from "react";
import {
	DraftArticleContext,
	PublishedArticleContext,
} from "~/components/article/context";
import { resolve_default_published_at } from "~/components/article/new-adapter";
import { useEditorContext } from "~/components/editor/editor-context";
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
	const editor_context = useEditorContext();

	const toaster = useToast();
	const router = useRouter();

	if (!draft_article) {
		throw new Error("Missing context");
	}

	// `save_draft` never blocks on an invalid heading (Q11: drafts are allowed
	// to be incomplete), so its own commit can leave an error in `statusText`
	// right before the mutation settles — this guards that settle from
	// clobbering a still-relevant error with a blank status.
	const save_had_error = useRef(false);

	const save_article_mutation = useMutation({
		mutationFn: (input: Parameters<typeof saveArticle>[0]) =>
			unwrap_server_function(saveArticle(input)),
		onSettled: () => {
			if (!save_had_error.current) editor_context.setStatusText(undefined);
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
			editor_context.setStatusText(undefined);
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

	const default_published_at = resolve_default_published_at(
		draft_article,
		published_article,
	);

	return {
		save_draft: async (
			override_published_at?: Date,
			thumbnail_crop?: ThumbnailType,
		) => {
			editor_context.setStatusText("Shranjujem osnutek ...");

			const result = await editor_context.commit({
				published_at: override_published_at ?? default_published_at,
				thumbnail_crop,
			});
			if (!result) return;

			save_had_error.current = Boolean(result.error);
			editor_context.setStatusText(result.error);

			const state = editor_store.getState();
			save_article_mutation.mutate({
				article_id: draft_article.id,
				article: {
					title: result.title,
					published_at: state.published_at,
					content: result.editor_content,
					thumbnail_crop: state.thumbnail_crop ?? undefined,
				},
				author_ids: state.author_ids,
			});
		},
		publish: async (
			override_published_at?: Date,
			thumbnail_crop?: ThumbnailType,
		) => {
			editor_context.setStatusText("Objavljam spremembe ...");

			const result = await editor_context.commit({
				published_at: override_published_at ?? default_published_at,
				thumbnail_crop,
			});
			if (!result) return;

			// Publish never proceeds with an invalid heading (Q11); save_draft
			// always proceeds — drafts may be incomplete work-in-progress.
			if (result.error) {
				editor_context.setStatusText(result.error);
				return;
			}

			const state = editor_store.getState();
			publish_article_mutation.mutate({
				article_id: draft_article.id,
				article: {
					title: result.title,
					published_at: state.published_at,
					content: result.editor_content,
					thumbnail_crop: state.thumbnail_crop ?? undefined,
				},
				author_ids: state.author_ids,
			});
		},
		delete_article: () => {
			editor_context.setStatusText("Brišem novičko ...");
			delete_article_mutation.mutate({ article_id: draft_article.id });
		},
		discard_draft: () => {
			editor_context.setStatusText("Zavračam osnutek ...");
			discard_draft_mutation.mutate({ article_id: draft_article.id });
		},
	};
}
