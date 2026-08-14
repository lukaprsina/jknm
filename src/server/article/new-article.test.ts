import { eq } from "drizzle-orm";
import { describe, expect, test, vi } from "vitest";
import { Article, users } from "../db/schema";
import { create_test_db } from "../db/test-helpers";
import { save_article } from "./new-article";

// `apply_server_invalidations` calls `next/cache`'s `revalidatePath`/`updateTag`,
// which require a live Next.js request context this unit test never has.
vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
	updateTag: vi.fn(),
}));

async function insert_draft(db: Awaited<ReturnType<typeof create_test_db>>) {
	await db
		.insert(users)
		.values({ id: "admin", name: "Admin", email: "admin@example.com" })
		.onConflictDoNothing();

	const [draft] = await db
		.insert(Article)
		.values({ title: "Untitled", status: "draft", created_by: "admin" })
		.returning();
	if (!draft) throw new Error("insert failed");
	return draft;
}

describe("save_article", () => {
	test("writes an explicit published_at from the settings-form date picker", async () => {
		const db = await create_test_db();
		const draft = await insert_draft(db);
		const picked = new Date("2026-03-01T00:00:00Z");

		await save_article(
			{
				article_id: draft.id,
				article: { title: "Untitled", published_at: picked },
				author_ids: [],
			},
			db,
		);

		const stored = await db.query.Article.findFirst({
			where: eq(Article.id, draft.id),
		});
		expect(stored?.published_at).toEqual(picked);
	});

	test("defaults an unset published_at to now on a first save", async () => {
		const db = await create_test_db();
		const draft = await insert_draft(db);
		const before = new Date();

		await save_article(
			{
				article_id: draft.id,
				article: { title: "Untitled" },
				author_ids: [],
			},
			db,
		);

		const stored = await db.query.Article.findFirst({
			where: eq(Article.id, draft.id),
		});
		expect(stored?.published_at).not.toBeNull();
		expect(stored?.published_at?.getTime()).toBeGreaterThanOrEqual(
			before.getTime(),
		);
	});

	test("a later save without an override keeps the previously picked date, not today", async () => {
		const db = await create_test_db();
		const draft = await insert_draft(db);
		const picked = new Date("2026-03-01T00:00:00Z");

		await save_article(
			{
				article_id: draft.id,
				article: { title: "Untitled", published_at: picked },
				author_ids: [],
			},
			db,
		);

		// Simulate reopening the editor and saving again without touching the
		// date picker — the regression this guards against reset it to today.
		await save_article(
			{
				article_id: draft.id,
				article: { title: "Untitled" },
				author_ids: [],
			},
			db,
		);

		const stored = await db.query.Article.findFirst({
			where: eq(Article.id, draft.id),
		});
		expect(stored?.published_at).toEqual(picked);
	});
});
