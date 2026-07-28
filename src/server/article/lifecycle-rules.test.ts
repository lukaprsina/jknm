import { describe, expect, test } from "vitest";
import {
	assert_can_archive,
	assert_can_delete,
	assert_can_discard,
	assert_can_supersede,
	decide_published_at,
	decide_slug_transition,
	get_archive_origin_label,
	is_supersede_publish,
	is_visible_to,
	resolve_lifecycle_target,
	resolve_slug_request,
	should_restore_source_on_discard,
} from "./lifecycle-rules";

describe("assert_can_archive", () => {
	test.each(["draft", "published"] as const)(
		"allows %s -> archived",
		(status) => {
			expect(() => assert_can_archive(status)).not.toThrow();
		},
	);

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
		const article = {
			id: "a",
			status: "published" as const,
			supersedes_id: null,
		};

		expect(resolve_lifecycle_target(article, null)).toEqual({
			target: article,
			cascade_delete_draft_id: null,
		});
	});

	test("a superseding draft targets its source, and flags itself for cascade delete", () => {
		const draft = {
			id: "draft-id",
			status: "draft" as const,
			supersedes_id: "source-id",
		};
		const source = {
			id: "source-id",
			status: "published" as const,
			supersedes_id: null,
		};

		expect(resolve_lifecycle_target(draft, source)).toEqual({
			target: source,
			cascade_delete_draft_id: "draft-id",
		});
	});

	test("throws if the superseding draft's source can't be found", () => {
		const draft = {
			id: "draft-id",
			status: "draft" as const,
			supersedes_id: "source-id",
		};

		expect(() => resolve_lifecycle_target(draft, null)).toThrow();
	});

	test("a draft whose source is already deleted (e.g. unarchive deleted it) targets itself, no cascade", () => {
		const draft = {
			id: "draft-id",
			status: "draft" as const,
			supersedes_id: "source-id",
		};
		const source = {
			id: "source-id",
			status: "deleted" as const,
			supersedes_id: null,
		};

		expect(resolve_lifecycle_target(draft, source)).toEqual({
			target: draft,
			cascade_delete_draft_id: null,
		});
	});
});

describe("should_restore_source_on_discard", () => {
	test("restores when the source was retired by unarchiving (deleted)", () => {
		expect(should_restore_source_on_discard({ status: "deleted" })).toBe(true);
	});

	test.each(["archived", "published", "draft"] as const)(
		"does not restore when the source is still %s",
		(status) => {
			expect(should_restore_source_on_discard({ status })).toBe(false);
		},
	);

	test("does not restore a standalone draft (no source)", () => {
		expect(should_restore_source_on_discard(null)).toBe(false);
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

describe("is_supersede_publish", () => {
	test.each(["archived", "published"] as const)(
		"is a supersede-publish when the source is still %s",
		(status) => {
			expect(is_supersede_publish({ status })).toBe(true);
		},
	);

	test("is not a supersede-publish when the source has no supersedes_id (standalone draft)", () => {
		expect(is_supersede_publish(null)).toBe(false);
	});

	test("falls back to a standalone first-publish when the source is already deleted (e.g. unarchive retired it)", () => {
		expect(is_supersede_publish({ status: "deleted" })).toBe(false);
	});

	test("rejects a source still in draft, which should never happen but must not be treated as supersedable", () => {
		expect(is_supersede_publish({ status: "draft" })).toBe(false);
	});
});

describe("decide_published_at", () => {
	const now = new Date("2026-07-28T00:00:00Z");

	test("inherits the source's published_at on a real supersede-publish", () => {
		const source_date = new Date("2013-05-01T00:00:00Z");
		expect(
			decide_published_at({
				source: { published_at: source_date },
				existing: { published_at: null },
				now,
			}),
		).toEqual(source_date);
	});

	test("still inherits the source's date on the unarchive path, where the source is already retired and is_supersede_publish is false", () => {
		const source_date = new Date("2024-01-16T00:00:00Z");
		expect(
			decide_published_at({
				source: { published_at: source_date },
				existing: { published_at: null },
				now,
			}),
		).toEqual(source_date);
	});

	test("falls back to the row's own published_at when there is no source", () => {
		const existing_date = new Date("2020-02-02T00:00:00Z");
		expect(
			decide_published_at({
				source: null,
				existing: { published_at: existing_date },
				now,
			}),
		).toEqual(existing_date);
	});

	test("falls back to now for a genuinely first-time publish (no source, no existing date)", () => {
		expect(
			decide_published_at({
				source: null,
				existing: { published_at: null },
				now,
			}),
		).toEqual(now);
	});

	test("falls back to now when the source itself has a null published_at (archived straight from draft)", () => {
		expect(
			decide_published_at({
				source: { published_at: null },
				existing: { published_at: null },
				now,
			}),
		).toEqual(now);
	});

	test("an explicit requested date overrides the source's inherited date", () => {
		const requested = new Date("2020-06-15T00:00:00Z");
		expect(
			decide_published_at({
				requested,
				source: { published_at: new Date("2013-05-01T00:00:00Z") },
				existing: { published_at: null },
				now,
			}),
		).toEqual(requested);
	});

	test("an explicit requested date overrides the row's own published_at when there is no source", () => {
		const requested = new Date("2020-06-15T00:00:00Z");
		expect(
			decide_published_at({
				requested,
				source: null,
				existing: { published_at: new Date("2020-02-02T00:00:00Z") },
				now,
			}),
		).toEqual(requested);
	});

	test("a null/undefined requested date falls back to the normal inheritance chain", () => {
		const source_date = new Date("2013-05-01T00:00:00Z");
		expect(
			decide_published_at({
				requested: null,
				source: { published_at: source_date },
				existing: { published_at: null },
				now,
			}),
		).toEqual(source_date);
	});
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

		expect(decision).toEqual({
			action: "mint_new_and_demote",
			demote_slug_id: 7,
		});
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

describe("resolve_slug_request", () => {
	function make_article(
		overrides: Partial<Parameters<typeof resolve_slug_request>[0]["article"]> &
			object = {},
	) {
		return {
			status: "published" as const,
			article_slugs: [{ slug: "jama-krizna", is_primary: true }],
			...overrides,
		};
	}

	test("renders when the requested slug is the primary one", () => {
		expect(
			resolve_slug_request({
				requested_slug: "jama-krizna",
				article: make_article(),
				is_admin: false,
			}),
		).toEqual({ outcome: "render" });
	});

	test("404s when no article resolved from the slug", () => {
		expect(
			resolve_slug_request({
				requested_slug: "nikoli-obstajala",
				article: undefined,
				is_admin: false,
			}),
		).toEqual({ outcome: "not_found" });
	});

	test("redirects an old non-primary slug to the primary one", () => {
		expect(
			resolve_slug_request({
				requested_slug: "stara-pot",
				article: make_article({
					article_slugs: [
						{ slug: "stara-pot", is_primary: false },
						{ slug: "nova-pot", is_primary: true },
					],
				}),
				is_admin: false,
			}),
		).toEqual({ outcome: "redirect_to_primary", slug: "nova-pot" });
	});

	// The ordering that matters: an invisible article must 404 rather than
	// redirect, or we'd point a crawler at a URL that then 404s — a wasted hop
	// and an ambiguous canonical signal.
	test("404s an old slug of an archived article instead of redirecting", () => {
		expect(
			resolve_slug_request({
				requested_slug: "stara-pot",
				article: make_article({
					status: "archived",
					article_slugs: [
						{ slug: "stara-pot", is_primary: false },
						{ slug: "nova-pot", is_primary: true },
					],
				}),
				is_admin: false,
			}),
		).toEqual({ outcome: "not_found" });
	});

	test("still redirects an archived article's old slug for an admin, who can see it", () => {
		expect(
			resolve_slug_request({
				requested_slug: "stara-pot",
				article: make_article({
					status: "archived",
					article_slugs: [
						{ slug: "stara-pot", is_primary: false },
						{ slug: "nova-pot", is_primary: true },
					],
				}),
				is_admin: true,
			}),
		).toEqual({ outcome: "redirect_to_primary", slug: "nova-pot" });
	});

	test("404s a deleted article for admins too", () => {
		expect(
			resolve_slug_request({
				requested_slug: "jama-krizna",
				article: make_article({ status: "deleted" }),
				is_admin: true,
			}),
		).toEqual({ outcome: "not_found" });
	});

	// Data anomaly: `create_article` always writes a primary slug, but if none is
	// flagged we must not invent a redirect — serving the article at the URL that
	// resolved it is strictly better than a loop or a 404.
	test("renders rather than redirecting when no slug is flagged primary", () => {
		expect(
			resolve_slug_request({
				requested_slug: "stara-pot",
				article: make_article({
					article_slugs: [{ slug: "stara-pot", is_primary: false }],
				}),
				is_admin: false,
			}),
		).toEqual({ outcome: "render" });
	});

	test("cannot ask for a redirect to the slug already requested", () => {
		const resolution = resolve_slug_request({
			requested_slug: "nova-pot",
			article: make_article({
				article_slugs: [
					{ slug: "stara-pot", is_primary: false },
					{ slug: "nova-pot", is_primary: true },
				],
			}),
			is_admin: false,
		});

		expect(resolution).toEqual({ outcome: "render" });
	});
});

describe("get_archive_origin_label", () => {
	test("labels a previously published article", () => {
		expect(get_archive_origin_label({ published_at: new Date() })).toBe(
			"bil objavljen",
		);
	});

	test("labels an article that was archived straight from draft", () => {
		expect(get_archive_origin_label({ published_at: null })).toBe(
			"bil osnutek",
		);
	});
});
