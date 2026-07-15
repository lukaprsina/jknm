"use server";

import { algoliasearch as searchClient } from "algoliasearch";
import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import type { z } from "zod";
import { env } from "~/env";
import { ALGOLIA_PUBLISHED_ARTICLE_INDEX } from "~/lib/algoliasearch";
import { assert_one } from "~/lib/assert-length";
import { type DbTransaction, db } from "../db";
import { Article, ArticlesToAuthors } from "../db/schema";
import { find_article_with_relations } from "./article-queries";
import { run_authorized_mutation } from "./authorized-mutation";
import {
	assert_can_archive,
	assert_can_delete,
	assert_can_supersede,
} from "./lifecycle-rules";
import { reconcile_media_to_articles } from "./reconcile-media";
import {
	archive_article_validator,
	create_superseding_draft_validator,
	delete_article_validator,
} from "./validators";

/**
 * Best-effort Algolia unlist: swallows errors (matches the existing
 * `unpublish`/`publish_article` pattern) since a stale search-index entry
 * isn't worth failing the DB transaction over.
 */
export async function remove_from_algolia(article_id: string) {
	try {
		const algolia = searchClient(
			env.NEXT_PUBLIC_ALGOLIA_ID,
			env.ALGOLIA_ADMIN_KEY,
		);
		await algolia.deleteObject({
			indexName: ALGOLIA_PUBLISHED_ARTICLE_INDEX,
			objectID: article_id,
		});
	} catch (error) {
		console.error("algolia error", error);
	}
}

/**
 * Retires a row: status -> `deleted`. Shared by `delete_article` and
 * supersede-publish's retirement of the row at `supersedes_id`
 * (`publish_article`). DB-only, no Algolia call — callers that need to
 * unlist a published row from search do that themselves, since only they
 * know whether the row was actually public.
 */
export async function soft_delete_article(
	tx: DbTransaction,
	article_id: string,
) {
	const updated = await tx
		.update(Article)
		.set({ status: "deleted", deleted_at: new Date() })
		.where(eq(Article.id, article_id))
		.returning();

	assert_one(updated);
	return updated[0];
}

/**
 * `draft`/`published` -> `archived`. Single mechanism for both "hide a
 * mistake" and "archive stale content" — no separate `hidden` status.
 */
export async function archive_article(
	input: z.infer<typeof archive_article_validator>,
) {
	const { input: validated_input } = await run_authorized_mutation(
		archive_article_validator,
		input,
	);

	const transaction = await db.transaction(async (tx) => {
		const existing = await tx.query.Article.findFirst({
			where: eq(Article.id, validated_input.article_id),
			columns: { id: true, status: true },
		});
		if (!existing) throw new Error("Article not found");
		assert_can_archive(existing.status);

		if (existing.status === "published") {
			await remove_from_algolia(existing.id);
		}

		const updated = await tx
			.update(Article)
			.set({ status: "archived", archived_at: new Date() })
			.where(eq(Article.id, validated_input.article_id))
			.returning();

		assert_one(updated);
		return find_article_with_relations(
			tx,
			eq(Article.id, validated_input.article_id),
		);
	});

	revalidateTag("drafts", "max");
	revalidateTag("archive", "max");
	revalidatePath("/");
	return transaction;
}

/**
 * `draft`/`published`/`archived` -> `deleted`. Direct, no confirmation-flow
 * complexity beyond the UI's plain confirm dialog. Terminal: no restore
 * action is exposed.
 */
export async function delete_article(
	input: z.infer<typeof delete_article_validator>,
) {
	const { input: validated_input } = await run_authorized_mutation(
		delete_article_validator,
		input,
	);

	const transaction = await db.transaction(async (tx) => {
		const existing = await tx.query.Article.findFirst({
			where: eq(Article.id, validated_input.article_id),
			columns: { id: true, status: true },
		});
		if (!existing) throw new Error("Article not found");
		assert_can_delete(existing.status);

		if (existing.status === "published") {
			await remove_from_algolia(existing.id);
		}

		return soft_delete_article(tx, validated_input.article_id);
	});

	revalidateTag("drafts", "max");
	revalidateTag("archive", "max");
	revalidatePath("/");
	return transaction;
}

/**
 * Spawns a new draft superseding an `archived` or `published` article:
 * unarchive (source `archived`) and "revise while staying live" (source
 * `published`) are the same mechanism, just triggered from different UI
 * states. The source row is untouched until the new draft is published
 * (supersede-publish, see `publish_article`).
 */
export async function create_superseding_draft(
	input: z.infer<typeof create_superseding_draft_validator>,
) {
	const { session, input: validated_input } = await run_authorized_mutation(
		create_superseding_draft_validator,
		input,
	);

	const transaction = await db.transaction(async (tx) => {
		const source = await find_article_with_relations(
			tx,
			eq(Article.id, validated_input.article_id),
		);
		if (!source) throw new Error("Article not found");
		assert_can_supersede(source.status);

		const created = await tx
			.insert(Article)
			.values({
				title: source.title,
				status: "draft",
				content_json: source.content_json,
				excerpt: source.excerpt,
				thumbnail_media_id: source.thumbnail_media_id,
				thumbnail_x: source.thumbnail_x,
				thumbnail_y: source.thumbnail_y,
				thumbnail_width: source.thumbnail_width,
				thumbnail_height: source.thumbnail_height,
				supersedes_id: source.id,
				created_by: session.user.id,
			})
			.returning();

		assert_one(created);
		const draft = created[0];

		if (source.articles_to_authors.length !== 0) {
			await tx.insert(ArticlesToAuthors).values(
				source.articles_to_authors.map((rel) => ({
					article_id: draft.id,
					author_id: rel.author_id,
					order: rel.order,
				})),
			);
		}

		await reconcile_media_to_articles(tx, draft.id, draft.content_json);

		return draft;
	});

	revalidateTag("drafts", "max");
	revalidatePath("/");
	return transaction;
}
