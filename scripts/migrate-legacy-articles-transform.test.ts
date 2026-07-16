import { describe, expect, test } from "vitest";
import type { ArticleContentType } from "~/server/db/schema";
import {
	build_draft_article_values,
	build_published_article_values,
	legacy_id_for_draft,
	legacy_id_for_published,
	resolve_legacy_thumbnail,
	rewrite_media_urls_in_content,
} from "./migrate-legacy-articles-transform";

describe("legacy_id_for_published / legacy_id_for_draft", () => {
	test("published ids pass through unchanged", () => {
		expect(legacy_id_for_published(42)).toBe(42);
	});

	test("draft ids are negated so they can't collide with published ids", () => {
		expect(legacy_id_for_draft(42)).toBe(-42);
	});
});

describe("rewrite_media_urls_in_content", () => {
	const url_map = new Map([
		["https://old.example/a.jpg", "https://gradivo.jknm.org/uuid-a/original.jpg"],
	]);

	test("returns null for null/undefined content", () => {
		expect(rewrite_media_urls_in_content(null, url_map)).toBeNull();
		expect(rewrite_media_urls_in_content(undefined, url_map)).toBeNull();
	});

	test("rewrites a mapped image block url", () => {
		const content: ArticleContentType = {
			blocks: [
				{ type: "image", data: { file: { url: "https://old.example/a.jpg" } } },
			],
		};

		const result = rewrite_media_urls_in_content(content, url_map);

		expect(result?.blocks[0]?.data).toMatchObject({
			file: { url: "https://gradivo.jknm.org/uuid-a/original.jpg" },
		});
	});

	test("leaves an unmapped url untouched", () => {
		const content: ArticleContentType = {
			blocks: [
				{ type: "image", data: { file: { url: "https://old.example/missing.jpg" } } },
			],
		};

		const result = rewrite_media_urls_in_content(content, url_map);

		expect(result?.blocks[0]?.data).toMatchObject({
			file: { url: "https://old.example/missing.jpg" },
		});
	});

	test("does not mutate the input content", () => {
		const content: ArticleContentType = {
			blocks: [
				{ type: "image", data: { file: { url: "https://old.example/a.jpg" } } },
			],
		};

		rewrite_media_urls_in_content(content, url_map);

		expect((content.blocks[0]?.data as { file: { url: string } }).file.url).toBe(
			"https://old.example/a.jpg",
		);
	});

	test("leaves non-media blocks untouched", () => {
		const content: ArticleContentType = {
			blocks: [{ type: "header", data: { text: "Hello", level: 1 } }],
		};

		const result = rewrite_media_urls_in_content(content, url_map);

		expect(result?.blocks[0]?.data).toEqual({ text: "Hello", level: 1 });
	});
});

describe("resolve_legacy_thumbnail", () => {
	test("clears the thumbnail when none is set", () => {
		expect(resolve_legacy_thumbnail(null, new Map())).toEqual({
			thumbnail_media_id: null,
			thumbnail_x: null,
			thumbnail_y: null,
			thumbnail_width: null,
			thumbnail_height: null,
		});
	});

	test("clears the thumbnail when its image url never migrated", () => {
		const thumbnail_crop = {
			image_url: "https://old.example/missing.jpg",
			unit: "%" as const,
			x: 1,
			y: 2,
			width: 3,
			height: 4,
		};

		expect(resolve_legacy_thumbnail(thumbnail_crop, new Map())).toEqual({
			thumbnail_media_id: null,
			thumbnail_x: null,
			thumbnail_y: null,
			thumbnail_width: null,
			thumbnail_height: null,
		});
	});

	test("resolves to the migrated media id, copying percentages straight across", () => {
		const thumbnail_crop = {
			image_url: "https://old.example/a.jpg",
			unit: "%" as const,
			x: 10,
			y: 20,
			width: 30,
			height: 40,
		};
		const url_to_media_id = new Map([["https://old.example/a.jpg", "media-uuid-1"]]);

		expect(resolve_legacy_thumbnail(thumbnail_crop, url_to_media_id)).toEqual({
			thumbnail_media_id: "media-uuid-1",
			thumbnail_x: 10,
			thumbnail_y: 20,
			thumbnail_width: 30,
			thumbnail_height: 40,
		});
	});

	test("falls back to a content image with the same basename when the crop's own url is unresolved", () => {
		// e.g. a draft-bucket thumbnail url (jknm-osnutki/1308/4.jpg) that 404s,
		// while the identical photo migrated fine as a published content image
		// under a different (published-bucket) url ending in the same "4.jpg".
		const thumbnail_crop = {
			image_url: "https://jknm-osnutki.example/1308/4.jpg",
			unit: "%" as const,
			x: 0,
			y: 25,
			width: 100,
			height: 75,
		};
		const url_to_media_id = new Map([
			["https://jknm-novice.example/some-article/4.jpg", "media-uuid-4"],
		]);

		expect(resolve_legacy_thumbnail(thumbnail_crop, url_to_media_id)).toEqual({
			thumbnail_media_id: "media-uuid-4",
			thumbnail_x: 0,
			thumbnail_y: 25,
			thumbnail_width: 100,
			thumbnail_height: 75,
		});
	});

	test("still clears the thumbnail when no basename matches either", () => {
		const thumbnail_crop = {
			image_url: "https://jknm-osnutki.example/1308/4.jpg",
			unit: "%" as const,
			x: 0,
			y: 25,
			width: 100,
			height: 75,
		};
		const url_to_media_id = new Map([
			["https://jknm-novice.example/some-article/5.jpg", "media-uuid-5"],
		]);

		expect(resolve_legacy_thumbnail(thumbnail_crop, url_to_media_id)).toEqual({
			thumbnail_media_id: null,
			thumbnail_x: null,
			thumbnail_y: null,
			thumbnail_width: null,
			thumbnail_height: null,
		});
	});
});

describe("build_published_article_values", () => {
	test("is status-preserving and uses created_at as the published_at proxy", () => {
		const created_at = new Date("2020-01-01T00:00:00Z");
		const updated_at = new Date("2020-01-02T00:00:00Z");

		const values = build_published_article_values(
			{
				legacy_id: 7,
				title: "Naslov",
				content_preview: "Predogled",
				content: null,
				created_at,
				updated_at,
			},
			null,
			{
				thumbnail_media_id: null,
				thumbnail_x: null,
				thumbnail_y: null,
				thumbnail_width: null,
				thumbnail_height: null,
			},
		);

		expect(values).toMatchObject({
			legacy_id: 7,
			status: "published",
			title: "Naslov",
			excerpt: "Predogled",
			published_at: created_at,
			created_at,
			updated_at,
			created_by: null,
		});
	});

	test("defaults excerpt to empty string when content_preview is null", () => {
		const values = build_published_article_values(
			{
				legacy_id: 1,
				title: "T",
				content_preview: null,
				content: null,
				created_at: new Date(),
				updated_at: new Date(),
			},
			null,
			{
				thumbnail_media_id: null,
				thumbnail_x: null,
				thumbnail_y: null,
				thumbnail_width: null,
				thumbnail_height: null,
			},
		);

		expect(values.excerpt).toBe("");
	});
});

describe("build_draft_article_values", () => {
	test("negates the legacy draft id and carries supersedes_id through", () => {
		const values = build_draft_article_values(
			{
				legacy_id: 9,
				title: "Osnutek",
				content_preview: "",
				content: null,
				created_at: new Date(),
				updated_at: new Date(),
			},
			null,
			{
				thumbnail_media_id: null,
				thumbnail_x: null,
				thumbnail_y: null,
				thumbnail_width: null,
				thumbnail_height: null,
			},
			"published-uuid-1",
		);

		expect(values).toMatchObject({
			legacy_id: -9,
			status: "draft",
			supersedes_id: "published-uuid-1",
		});
	});

	test("standalone drafts get a null supersedes_id", () => {
		const values = build_draft_article_values(
			{
				legacy_id: 9,
				title: "Osnutek",
				content_preview: "",
				content: null,
				created_at: new Date(),
				updated_at: new Date(),
			},
			null,
			{
				thumbnail_media_id: null,
				thumbnail_x: null,
				thumbnail_y: null,
				thumbnail_width: null,
				thumbnail_height: null,
			},
			null,
		);

		expect(values.supersedes_id).toBeNull();
	});
});
