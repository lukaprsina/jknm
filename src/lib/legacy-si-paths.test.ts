import { describe, expect, it } from "vitest";
import {
	is_valid_legacy_id,
	resolve_legacy_id_redirect,
	resolve_legacy_static_path,
} from "./legacy-si-paths";

function article(
	status: "draft" | "published" | "archived" | "deleted",
	slugs: { is_primary: boolean; slug: string }[],
) {
	return { status, article_slugs: slugs };
}

describe("resolve_legacy_static_path", () => {
	it.each([
		[["klub"], "/klub"],
		[["klub", "interes"], "/klub"],
		[["klub", "povezave"], "/klub"],
		[["klub", "zgodovina"], "/zgodovina"],
		[["klub", "zgodovina", "1962"], "/zgodovina"],
		[["publikacije"], "/publiciranje"],
		[["publikacije", "kras01"], "/publiciranje"],
		[["raziskovanje"], "/raziskovanje"],
		[["raziskovanje", "kanin"], "/raziskovanje"],
		[["varstvo"], "/varstvo"],
		[["etc", "kontakt"], "/stik-z-nami"],
		[["etc", "iskanje"], "/arhiv"],
	])("redirects %j to %s", (segments, path) => {
		expect(resolve_legacy_static_path(segments)).toEqual({
			outcome: "redirect",
			path,
		});
	});

	it.each([
		[["jame"]],
		[["jame", "naj", "najgloblje.htm"]],
		[["kataster"]],
		[["kataster", "jknm"]],
		[["jrs"]],
		[["izobrazevanje"]],
		[["navodila"]],
		[["download"]],
		[["etc", "clani"]],
		[["etc", "impresum"]],
		[["varnost", "piskotki"]],
		[["unknown-section"]],
		[[]],
	])("marks %j as gone", (segments) => {
		expect(resolve_legacy_static_path(segments)).toEqual({ outcome: "gone" });
	});
});

describe("is_valid_legacy_id", () => {
	it.each([["0"], ["1"], ["42"], ["2147483647"]])("accepts %j", (id) => {
		expect(is_valid_legacy_id(id)).toBe(true);
	});

	it.each([
		["not-a-number"],
		["12.5"],
		["-1"],
		["2147483648"],
		[""],
	])("rejects %j", (id) => {
		expect(is_valid_legacy_id(id)).toBe(false);
	});
});

describe("resolve_legacy_id_redirect", () => {
	it("marks a missing article as gone", () => {
		expect(resolve_legacy_id_redirect(null)).toEqual({ outcome: "gone" });
	});

	it.each(["draft", "archived", "deleted"] as const)(
		"marks a %s article as gone",
		(status) => {
			const found = article(status, [
				{ is_primary: true, slug: "primary-slug" },
			]);
			expect(resolve_legacy_id_redirect(found)).toEqual({ outcome: "gone" });
		},
	);

	it("marks a published article with no slugs as gone", () => {
		const found = article("published", []);
		expect(resolve_legacy_id_redirect(found)).toEqual({ outcome: "gone" });
	});

	it("redirects a published article to its primary slug", () => {
		const found = article("published", [
			{ is_primary: false, slug: "old-slug" },
			{ is_primary: true, slug: "primary-slug" },
		]);
		expect(resolve_legacy_id_redirect(found)).toEqual({
			outcome: "redirect",
			path: "/novica/primary-slug",
		});
	});

	it("falls back to the first slug when none is primary", () => {
		const found = article("published", [
			{ is_primary: false, slug: "only-slug" },
		]);
		expect(resolve_legacy_id_redirect(found)).toEqual({
			outcome: "redirect",
			path: "/novica/only-slug",
		});
	});
});
