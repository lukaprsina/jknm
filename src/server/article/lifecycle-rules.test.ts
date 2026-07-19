import { describe, expect, test } from "vitest";
import {
	assert_can_archive,
	assert_can_delete,
	assert_can_discard,
	assert_can_supersede,
	decide_slug_transition,
	get_archive_origin_badge,
	is_visible_to,
	resolve_lifecycle_target,
} from "./lifecycle-rules";

describe("assert_can_archive", () => {
	test.each(["draft", "published"] as const)("allows %s -> archived", (status) => {
		expect(() => assert_can_archive(status)).not.toThrow();
	});

	test.each(["archived", "deleted"] as const)(
		"rejects %s -> archived",
		(status) => {
			expect(() => assert_can_archive(status)).toThrow();
		},
	);
});

describe("assert_can_delete", () => {
	test.each(["draft", "published", "archived"] as const)(
		"allows %s -> deleted",
		(status) => {
			expect(() => assert_can_delete(status)).not.toThrow();
		},
	);

	test("rejects deleted -> deleted", () => {
		expect(() => assert_can_delete("deleted")).toThrow();
	});
});

describe("assert_can_discard", () => {
	test("allows discarding a superseding draft", () => {
		expect(() =>
			assert_can_discard({ status: "draft", supersedes_id: "source-id" }),
		).not.toThrow();
	});

	test("rejects discarding a standalone draft (no source to fall back to)", () => {
		expect(() =>
			assert_can_discard({ status: "draft", supersedes_id: null }),
		).toThrow();
	});

	test.each(["published", "archived", "deleted"] as const)(
		"rejects discarding a non-draft (%s)",
		(status) => {
			expect(() =>
				assert_can_discard({ status, supersedes_id: "source-id" }),
			).toThrow();
		},
	);
});

describe("resolve_lifecycle_target", () => {
	test("a standalone draft/published/archived row targets itself", () => {
		const article = { id: "a", status: "published" as const, supersedes_id: null };

		expect(resolve_lifecycle_target(article, null)).toEqual({
			target: article,
			cascade_delete_draft_id: null,
		});
	});

	test("a superseding draft targets its source, and flags itself for cascade delete", () => {
		const draft = { id: "draft-id", status: "draft" as const, supersedes_id: "source-id" };
		const source = { id: "source-id", status: "published" as const, supersedes_id: null };

		expect(resolve_lifecycle_target(draft, source)).toEqual({
			target: source,
			cascade_delete_draft_id: "draft-id",
		});
	});

	test("throws if the superseding draft's source can't be found", () => {
		const draft = { id: "draft-id", status: "draft" as const, supersedes_id: "source-id" };

		expect(() => resolve_lifecycle_target(draft, null)).toThrow();
	});
});

describe("assert_can_supersede", () => {
	test.each(["archived", "published"] as const)(
		"allows spawning a superseding draft from %s",
		(status) => {
			expect(() => assert_can_supersede(status)).not.toThrow();
		},
	);

	test.each(["draft", "deleted"] as const)(
		"rejects spawning a superseding draft from %s",
		(status) => {
			expect(() => assert_can_supersede(status)).toThrow();
		},
	);
});

describe("decide_slug_transition", () => {
	test("reuses the old primary slug (re-pointed to the new article) when the title is unchanged", () => {
		const decision = decide_slug_transition({
			old_title: "Potop v jami",
			new_title: "Potop v jami",
			old_primary_slug: { id: 7 },
		});

		expect(decision).toEqual({ action: "reuse", slug_id: 7 });
	});

	test("mints a new primary slug and demotes the old one when the title changed", () => {
		const decision = decide_slug_transition({
			old_title: "Potop v jami",
			new_title: "Potop v novi jami",
			old_primary_slug: { id: 7 },
		});

		expect(decision).toEqual({ action: "mint_new_and_demote", demote_slug_id: 7 });
	});

	test("mints a fresh slug when the superseded article never had a primary slug", () => {
		const decision = decide_slug_transition({
			old_title: "Potop v jami",
			new_title: "Potop v jami",
			old_primary_slug: null,
		});

		expect(decision).toEqual({ action: "mint_new" });
	});

	test("mints a fresh slug (not reuse) when title changed and there was no old primary slug", () => {
		const decision = decide_slug_transition({
			old_title: "Potop v jami",
			new_title: "Potop v novi jami",
			old_primary_slug: null,
		});

		expect(decision).toEqual({ action: "mint_new" });
	});
});

describe("is_visible_to", () => {
	test("deleted is hidden from everyone, including admins", () => {
		expect(is_visible_to("deleted", true)).toBe(false);
		expect(is_visible_to("deleted", false)).toBe(false);
	});

	test("archived is admin-only", () => {
		expect(is_visible_to("archived", true)).toBe(true);
		expect(is_visible_to("archived", false)).toBe(false);
	});

	test("published is visible to everyone", () => {
		expect(is_visible_to("published", true)).toBe(true);
		expect(is_visible_to("published", false)).toBe(true);
	});
});

describe("get_archive_origin_badge", () => {
	test("labels a previously published article", () => {
		expect(get_archive_origin_badge({ published_at: new Date() })).toBe(
			"bil objavljen",
		);
	});

	test("labels an article that was archived straight from draft", () => {
		expect(get_archive_origin_badge({ published_at: null })).toBe("bil osnutek");
	});
});
