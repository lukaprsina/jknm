import { eq } from "drizzle-orm";
import { describe, expect, test, vi } from "vitest";
import type { Session } from "../auth/session-shape";
import { Article, users } from "../db/schema";
import { create_test_db } from "../db/test-helpers";
import { create_superseding_draft } from "./lifecycle";

// `apply_server_invalidations` calls `next/cache`'s `revalidatePath`/`updateTag`,
// which require a live Next.js request context this unit test never has.
vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
	updateTag: vi.fn(),
}));

const session: Session = {
	user: { id: "admin", name: null, email: null, image: null },
	expires: new Date().toISOString(),
};

describe("create_superseding_draft", () => {
	test("copies the source's article_kind onto the new draft", async () => {
		const db = await create_test_db();

		await db
			.insert(users)
			.values({ id: "admin", name: "Admin", email: "admin@example.com" });

		const [source] = await db
			.insert(Article)
			.values({
				title: "Zgodovina",
				status: "published",
				article_kind: "content",
				published_at: new Date("2020-01-01"),
			})
			.returning();
		if (!source) throw new Error("insert failed");

		const draft = await create_superseding_draft(
			{ article_id: source.id },
			session,
			db,
		);

		const stored = await db.query.Article.findFirst({
			where: eq(Article.id, draft.id),
		});

		expect(stored?.article_kind).toBe("content");
	});
});
