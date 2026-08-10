import { describe, expect, test } from "vitest";
import {
	type AlgoliaArticleHit,
	compute_algolia_sync_diff,
	type DbArticleSummary,
} from "./sync-algolia-diff";

const hit = (
	overrides: Partial<AlgoliaArticleHit> = {},
): AlgoliaArticleHit => ({
	objectID: "a1",
	title: "Prvi članek",
	url: "prvi-clanek",
	article_kind: "article",
	updated_at: 1000,
	has_thumbnail: false,
	image: undefined,
	author_ids: [1],
	...overrides,
});

const article = (
	overrides: Partial<DbArticleSummary> = {},
): DbArticleSummary => ({
	id: "a1",
	title: "Prvi članek",
	url: "prvi-clanek",
	article_kind: "article",
	updated_at: 1000,
	has_thumbnail: false,
	image: undefined,
	author_ids: [1],
	...overrides,
});

describe("compute_algolia_sync_diff", () => {
	test("reports no changes when Algolia and the DB already agree", () => {
		expect(compute_algolia_sync_diff([hit()], [article()])).toEqual([]);
	});

	test("reports a published DB article absent from Algolia as 'missing'", () => {
		const changes = compute_algolia_sync_diff([], [article()]);

		expect(changes).toEqual([{ kind: "missing", article: article() }]);
	});

	test("reports a changed field as 'stale', listing only the fields that differ", () => {
		const changes = compute_algolia_sync_diff(
			[hit({ title: "Star naslov" })],
			[article()],
		);

		expect(changes).toEqual([
			{
				kind: "stale",
				article: article(),
				before: hit({ title: "Star naslov" }),
				diffs: [
					{ field: "title", before: "Star naslov", after: "Prvi članek" },
				],
			},
		]);
	});

	test("diffs updated_at and has_thumbnail/image using string coercion", () => {
		const changes = compute_algolia_sync_diff(
			[hit({ updated_at: 500, has_thumbnail: true, image: "old.jpg" })],
			[article({ updated_at: 1000, has_thumbnail: false, image: undefined })],
		);

		expect(changes).toEqual([
			{
				kind: "stale",
				article: article({
					updated_at: 1000,
					has_thumbnail: false,
					image: undefined,
				}),
				before: hit({ updated_at: 500, has_thumbnail: true, image: "old.jpg" }),
				diffs: [
					{ field: "updated_at", before: "500", after: "1000" },
					{ field: "has_thumbnail", before: "true", after: "false" },
					{ field: "image", before: "old.jpg", after: null },
				],
			},
		]);
	});

	test("reports a reordered/changed author list as 'stale', order-sensitive", () => {
		const changes = compute_algolia_sync_diff(
			[hit({ author_ids: [1, 2] })],
			[article({ author_ids: [2, 1] })],
		);

		expect(changes).toEqual([
			{
				kind: "stale",
				article: article({ author_ids: [2, 1] }),
				before: hit({ author_ids: [1, 2] }),
				diffs: [{ field: "author_ids", before: "1, 2", after: "2, 1" }],
			},
		]);
	});

	test("reports a pre-#37 hit with no article_kind field as 'stale', so a resync backfills it", () => {
		const changes = compute_algolia_sync_diff(
			[hit({ article_kind: undefined })],
			[article()],
		);

		expect(changes).toEqual([
			{
				kind: "stale",
				article: article(),
				before: hit({ article_kind: undefined }),
				diffs: [{ field: "article_kind", before: null, after: "article" }],
			},
		]);
	});

	test("reports an Algolia hit with no matching published DB article as 'orphaned'", () => {
		const changes = compute_algolia_sync_diff(
			[hit({ objectID: "stale-1" })],
			[],
		);

		expect(changes).toEqual([
			{ kind: "orphaned", before: hit({ objectID: "stale-1" }) },
		]);
	});

	test("matches by objectID/id, not by row order", () => {
		const changes = compute_algolia_sync_diff(
			[hit({ objectID: "a2", title: "Drugi" })],
			[article({ id: "a1" }), article({ id: "a2", title: "Drugi" })],
		);

		expect(changes).toEqual([
			{ kind: "missing", article: article({ id: "a1" }) },
		]);
	});
});
