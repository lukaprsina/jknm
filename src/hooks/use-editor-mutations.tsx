"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useContext } from "react";
import type { z } from "zod";
import { DraftArticleContext } from "~/components/article/context";
import { EditorContext } from "~/components/editor/editor-context";
import {
	update_settings_from_editor,
	validate_article,
} from "~/components/editor/editor-lib";
import { editor_store } from "~/components/editor/editor-store";
import { useToast } from "~/hooks/use-toast";
import type { ThumbnailType } from "~/lib/validators";
import { delete_article } from "~/server/article/lifecycle";
import { publish_article, save_article } from "~/server/article/new-article";
import type {
	delete_article_validator,
	publish_article_validator,
	save_article_validator,
} from "~/server/article/validators";

export function useEditorMutations() {
	const query_client = useQueryClient();
	const draft_article = useContext(DraftArticleContext);
	const editor_context = useContext(EditorContext);

	const toaster = useToast();
	const router = useRouter();

	if (!draft_article || !editor_context) {
		throw new Error("Missing context");
	}

	const save_article_mutation = useMutation({
		mutationFn: (input: z.infer<typeof save_article_validator>) =>
			save_article(input),
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
		mutationFn: (input: z.infer<typeof publish_article_validator>) =>
			publish_article(input),
		onSuccess: (data) => {
			router.push(`/novica/${data.slug}`);
		},
		onSettled: async () => {
			editor_context.setSavingText(undefined);
			editor_context.setDirty(false);
			await query_client.invalidateQueries({
				queryKey: ["infinite_published"],
			});
		},
		onError: (error) => {
			toaster.toast({
				title: "Napaka pri objavljanju novičke",
				description: error.message,
			});
		},
	});

	const delete_article_mutation = useMutation({
		mutationFn: (input: z.infer<typeof delete_article_validator>) =>
			delete_article(input),
		onSettled: async () => {
			await query_client.invalidateQueries({
				queryKey: ["infinite_published"],
			});
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

			const article_id = draft_article.id;

			const updated = validate_article(editor_content, toaster);
			const created_at = fake_created_at ?? draft_article.created_at;

			const state = editor_store.get("state");
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

			const state = editor_store.get("state");
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
	};
}
