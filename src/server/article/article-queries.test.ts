import { describe, expect, test } from "vitest";
import { Article } from "../db/schema";
import { create_test_db } from "../db/test-helpers";
import {
	find_articles_for_verification,
	find_draft_articles,
	find_published_articles_page,
} from "./article-queries";

function make_article(overrides: Partial<typeof Article.$inferInsert> = {}) {
	const now = new Date();
	return {
		title: "Untitled",
		content_json: null,
		created_at: now,
		updated_at: now,
		...overrides,
	} satisfies typeof Article.$inferInsert;
}

describe("find_published_articles_page", () => {
	test("returns only published articles, newest first", async () => {
		const db = await create_test_db();

		await db.insert(Article).values([
			make_article({
				title: "Published old",
				status: "published",
				created_at: new Date("2026-01-01"),
			}),
			make_article({
				title: "Published new",
				status: "published",
				created_at: new Date("2026-02-01"),
			}),
			make_article({
				title: "Draft",
				status: "draft",
				created_at: new Date("2026-03-01"),
			}),
			make_article({
				title: "Archived",
				status: "archived",
				created_at: new Date("2026-04-01"),
			}),
		]);

		const page = await find_published_articles_page(db, { limit: 10 });

		expect(page.map((a) => a.title)).toEqual([
			"Published new",
			"Published old",
		]);
	});

	test("cursors past the given created_at, continuing newest-first", async () => {
		const db = await create_test_db();

		await db.insert(Article).values([
			make_article({
				title: "Page 1",
				status: "published",
				created_at: new Date("2026-03-01"),
			}),
			make_article({
				title: "Page 2",
				status: "published",
				created_at: new Date("2026-02-01"),
			}),
			make_article({
				title: "Page 3",
				status: "published",
				created_at: new Date("2026-01-01"),
			}),
		]);

		const next_page = await find_published_articles_page(db, {
			limit: 10,
			cursor: new Date("2026-02-01"),
		});

		expect(next_page.map((a) => a.title)).toEqual(["Page 3"]);
	});
});

describe("find_draft_articles", () => {
	test("returns only draft articles, most recently updated first", async () => {
		const db = await create_test_db();

		await db.insert(Article).values([
			make_article({
				title: "Draft old",
				status: "draft",
				updated_at: new Date("2026-01-01"),
			}),
			make_article({
				title: "Draft new",
				status: "draft",
				updated_at: new Date("2026-02-01"),
			}),
			make_article({ title: "Published", status: "published" }),
			make_article({ title: "Archived", status: "archived" }),
		]);

		const drafts = await find_draft_articles(db);

		expect(drafts.map((a) => a.title)).toEqual(["Draft new", "Draft old"]);
	});
});

describe("find_articles_for_verification", () => {
	test("projects id + legacy_id for published/archived articles, ordered by legacy_id, excluding drafts and deleted", async () => {
		const db = await create_test_db();

		await db.insert(Article).values([
			make_article({
				title: "New, unmigrated",
				status: "published",
			}),
			make_article({
				title: "Legacy 5",
				status: "published",
				legacy_id: 5,
			}),
			make_article({
				title: "Legacy 2",
				status: "archived",
				legacy_id: 2,
			}),
			make_article({ title: "Still a draft", status: "draft" }),
			make_article({
				title: "Deleted",
				status: "deleted",
				legacy_id: 9,
			}),
		]);

		const rows = await find_articles_for_verification(db);

		expect(rows.map((r) => r.legacy_id)).toEqual([2, 5, null]);
	});
});
