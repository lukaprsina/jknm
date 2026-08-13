import type { OutputData } from "@editorjs/editorjs";
import { describe, expect, test } from "vitest";
import { to_nav_section } from "./static-nav-sections";

function header_block(text: string, level: number) {
	return { type: "header", data: { text, level } };
}

function content(blocks: { type: string; data: unknown }[]): OutputData {
	return { time: 0, version: "1", blocks };
}

describe("to_nav_section", () => {
	test("builds a nav section from the article's title and h2 headings", () => {
		const section = to_nav_section("zgodovina", {
			title: "Zgodovina",
			content_json: content([
				header_block("Zgodovina", 1),
				header_block("1962 Ustanovitev", 2),
				header_block("Podpoglavje", 3),
				header_block("1970 Razcvet", 2),
			]),
		});

		expect(section).toEqual({
			section: "zgodovina",
			title: "Zgodovina",
			headings: [
				{ id: "1962-ustanovitev", title: "1962 Ustanovitev" },
				{ id: "1970-razcvet", title: "1970 Razcvet" },
			],
		});
	});

	test("excludes h3 headings, unlike the in-page article ToC", () => {
		const section = to_nav_section("varstvo", {
			title: "Varstvo",
			content_json: content([
				header_block("Varstvo", 1),
				header_block("Podpoglavje", 3),
			]),
		});

		expect(section?.headings).toEqual([]);
	});

	test("returns null when the row hasn't been migrated/published yet", () => {
		expect(to_nav_section("klub", undefined)).toBeNull();
	});

	test("returns null when the row has no content", () => {
		expect(
			to_nav_section("klub", { title: "Klub", content_json: null }),
		).toBeNull();
	});
});
