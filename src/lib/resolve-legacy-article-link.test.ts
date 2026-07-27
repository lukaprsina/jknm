import { describe, expect, it } from "vitest";
import { resolve_legacy_article_link } from "./resolve-legacy-article-link";

describe("resolve_legacy_article_link", () => {
	it("resolves to /novica/<primary slug>", async () => {
		const url = await resolve_legacy_article_link(623, async (legacy_id) => {
			expect(legacy_id).toBe(623);
			return {
				article_slugs: [
					{ slug: "old-slug", is_primary: false },
					{ slug: "current-slug", is_primary: true },
				],
			};
		});
		expect(url).toBe("/novica/current-slug");
	});

	it("throws when no article has that legacy_id", async () => {
		await expect(
			resolve_legacy_article_link(999, async () => undefined),
		).rejects.toThrow(/999/);
	});

	it("throws when the matched article has no primary slug", async () => {
		await expect(
			resolve_legacy_article_link(1, async () => ({
				article_slugs: [{ slug: "x", is_primary: false }],
			})),
		).rejects.toThrow(/primary slug/);
	});
});
