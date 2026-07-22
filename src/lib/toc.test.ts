import type { Toc } from "@stefanprobst/rehype-extract-toc";
import { describe, expect, test } from "vitest";
import { flatten_toc } from "./toc";

describe("flatten_toc", () => {
	test("keeps H2/H3, drops H1, flattens the nested tree in document order", () => {
		const toc: Toc = [
			{
				value: "Naslov",
				depth: 1,
				id: "naslov",
				children: [
					{
						value: "Prvo poglavje",
						depth: 2,
						id: "prvo-poglavje",
						children: [{ value: "Podpoglavje", depth: 3, id: "podpoglavje" }],
					},
					{ value: "Drugo poglavje", depth: 2, id: "drugo-poglavje" },
				],
			},
		];

		expect(flatten_toc(toc)).toEqual([
			{ id: "prvo-poglavje", title: "Prvo poglavje", depth: 2 },
			{ id: "podpoglavje", title: "Podpoglavje", depth: 3 },
			{ id: "drugo-poglavje", title: "Drugo poglavje", depth: 2 },
		]);
	});

	test("drops entries missing an id", () => {
		const toc: Toc = [{ value: "Brez id-ja", depth: 2 }];

		expect(flatten_toc(toc)).toEqual([]);
	});

	test("drops H4 and deeper", () => {
		const toc: Toc = [
			{
				value: "Poglavje",
				depth: 2,
				id: "poglavje",
				children: [{ value: "Pregloboko", depth: 4, id: "pregloboko" }],
			},
		];

		expect(flatten_toc(toc)).toEqual([
			{ id: "poglavje", title: "Poglavje", depth: 2 },
		]);
	});

	test("respects a custom levels list", () => {
		const toc: Toc = [{ value: "Naslov", depth: 1, id: "naslov" }];

		expect(flatten_toc(toc, [1])).toEqual([
			{ id: "naslov", title: "Naslov", depth: 1 },
		]);
	});

	test("returns an empty array for an empty toc", () => {
		expect(flatten_toc([])).toEqual([]);
	});
});
