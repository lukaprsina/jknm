import type { OutputData } from "@editorjs/editorjs";
import { describe, expect, test } from "vitest";
import { extract_headings_from_content } from "./editor-utils";

function header_block(text: string, level: number) {
	return { type: "header", data: { text, level } };
}

function content(blocks: { type: string; data: unknown }[]): OutputData {
	return { time: 0, version: "1", blocks };
}

describe("extract_headings_from_content", () => {
	test("returns a single H2 heading", () => {
		const headings = extract_headings_from_content(
			content([header_block("Zgodovina", 2)]),
		);

		expect(headings).toEqual([
			{ id: "zgodovina", title: "Zgodovina", depth: 2, block_index: 0 },
		]);
	});

	test("includes H2 and H3, in document order", () => {
		const headings = extract_headings_from_content(
			content([
				header_block("Prvo", 2),
				header_block("Podpoglavje", 3),
				header_block("Drugo", 2),
			]),
		);

		expect(headings.map((h) => h.title)).toEqual([
			"Prvo",
			"Podpoglavje",
			"Drugo",
		]);
		expect(headings.map((h) => h.depth)).toEqual([2, 3, 2]);
	});

	test("excludes levels outside the given range (default H2/H3)", () => {
		const headings = extract_headings_from_content(
			content([
				header_block("Naslov", 1),
				header_block("Poglavje", 2),
				header_block("Pod-pod-poglavje", 4),
			]),
		);

		expect(headings).toHaveLength(1);
		expect(headings[0]?.title).toBe("Poglavje");
	});

	test("respects a custom levels list", () => {
		const headings = extract_headings_from_content(
			content([header_block("Naslov", 1), header_block("Poglavje", 2)]),
			[1],
		);

		expect(headings).toHaveLength(1);
		expect(headings[0]?.title).toBe("Naslov");
	});

	test("dedupes repeated heading text like rehype-slug (first occurrence unsuffixed)", () => {
		const headings = extract_headings_from_content(
			content([
				header_block("Odkritja", 2),
				header_block("Odkritja", 2),
				header_block("Odkritja", 2),
			]),
		);

		expect(headings.map((h) => h.id)).toEqual([
			"odkritja",
			"odkritja-1",
			"odkritja-2",
		]);
	});

	test("returns an empty array when there are no headings", () => {
		const headings = extract_headings_from_content(
			content([{ type: "paragraph", data: { text: "Besedilo" } }]),
		);

		expect(headings).toEqual([]);
	});

	test("skips a heading that sanitizes to an empty title", () => {
		const headings = extract_headings_from_content(
			content([header_block("<b></b>", 2)]),
		);

		expect(headings).toEqual([]);
	});
});
