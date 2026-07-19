"use server";

import { eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "../db";
import { Article, ArticleSlug } from "../db/schema";
import { find_article_with_relations } from "./article-queries";
import { get_article_by_new_id_validator } from "./validators";

// --- Unified `articles` table (#20) ---

export async function get_article_by_new_id(
	input: z.infer<typeof get_article_by_new_id_validator>,
) {
	const validated_input = get_article_by_new_id_validator.safeParse(input);
	if (!validated_input.success) {
		throw new Error(validated_input.error.message);
	}

	return find_article_with_relations(db, eq(Article.id, input.id));
}

export async function get_new_article_by_slug(slug: string) {
	const slug_row = await db.query.ArticleSlug.findFirst({
		where: eq(ArticleSlug.slug, slug),
		columns: { article_id: true },
	});

	if (!slug_row) return undefined;

	return find_article_with_relations(db, eq(Article.id, slug_row.article_id));
}
