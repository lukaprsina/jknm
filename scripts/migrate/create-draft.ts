/**
 * Draft-creation helper for the static-page migration (#36): mirrors
 * `create_article` (`src/server/article/new-article.ts`) as a direct DB
 * insert rather than calling the `createArticle` oRPC action -- that action
 * is an `@orpc/next` server action, not a stable fetchable endpoint, and no
 * browser/auth session is available (or needed) from a script.
 */

import { and, eq } from "drizzle-orm";
import { db } from "~/server/db";
import { Article, users } from "~/server/db/schema";

export async function pick_admin_user_id(admin_email: string | undefined) {
	const row = admin_email
		? await db.query.users.findFirst({ where: eq(users.email, admin_email) })
		: await db.query.users.findFirst();
	if (!row) {
		throw new Error(
			admin_email
				? `No user row for ${admin_email}`
				: "No user rows exist -- sign in once via the app first.",
		);
	}
	return row.id;
}

/**
 * Migrating a page is re-run until the draft looks right (#36 step 5), so
 * find the pilot's own prior attempt (unpublished, content-kind, same title)
 * instead of inserting a fresh row every time -- otherwise reruns pile up
 * orphaned drafts nobody cleans up.
 */
export async function find_existing_content_draft(title: string) {
	return db.query.Article.findFirst({
		where: and(
			eq(Article.title, title),
			eq(Article.status, "draft"),
			eq(Article.article_kind, "content"),
		),
	});
}

export async function create_draft(title: string, created_by: string) {
	const [created] = await db
		.insert(Article)
		.values({
			title,
			status: "draft",
			article_kind: "content",
			content_json: {
				blocks: [{ id: "sheNwCUP5A", type: "header", data: { text: title, level: 1 } }],
			},
			created_by,
		})
		.returning();
	if (!created) throw new Error("Insert returned no row");
	return created;
}
