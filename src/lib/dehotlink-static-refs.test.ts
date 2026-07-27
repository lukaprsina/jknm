import { describe, expect, it } from "vitest";
import {
	find_legacy_id_refs,
	find_pdf_refs,
	static_asset_key,
} from "./dehotlink-static-refs";

describe("find_pdf_refs", () => {
	it("finds absolute jknm.si media links inside markdown link syntax", () => {
		const mdx =
			"[Slugova jama](https://www.jknm.si/media/pdf/1055_Slugova.pdf) je globoka.";
		expect(find_pdf_refs(mdx)).toEqual([
			"https://www.jknm.si/media/pdf/1055_Slugova.pdf",
		]);
	});

	it("matches both /media/pdf/ and /media/DK/ prefixes, and non-www/http variants", () => {
		const mdx = [
			"https://www.jknm.si/media/pdf/a.pdf",
			"http://www.jknm.si/media/DK/b.pdf",
			"https://jknm.si/media/DK/c.pdf",
		].join(" ");
		expect(find_pdf_refs(mdx)).toEqual([
			"https://www.jknm.si/media/pdf/a.pdf",
			"http://www.jknm.si/media/DK/b.pdf",
			"https://jknm.si/media/DK/c.pdf",
		]);
	});

	it("matches other jknm.si subdomains too (e.g. the admin-gated edit.jknm.si)", () => {
		const mdx = "http://edit.jknm.si/media/pdf/Prva_pomoc_v_jamarstvu.pdf";
		expect(find_pdf_refs(mdx)).toEqual([
			"http://edit.jknm.si/media/pdf/Prva_pomoc_v_jamarstvu.pdf",
		]);
	});

	it("dedupes repeated links and stops at the closing paren/quote/whitespace", () => {
		const mdx =
			"([Slugova](https://www.jknm.si/media/pdf/1055.pdf)) and again (https://www.jknm.si/media/pdf/1055.pdf)";
		expect(find_pdf_refs(mdx)).toEqual([
			"https://www.jknm.si/media/pdf/1055.pdf",
		]);
	});

	it("ignores si/?id= links and non-jknm.si urls", () => {
		const mdx =
			"[old article](https://www.jknm.si/si/?id=623&l=2016) and [other](https://skfb.ly/OKzp)";
		expect(find_pdf_refs(mdx)).toEqual([]);
	});
});

describe("find_legacy_id_refs", () => {
	it("extracts the numeric id, ignoring the optional &l= year", () => {
		const mdx = "[x](https://www.jknm.si/si/?id=623&l=2016)";
		expect(find_legacy_id_refs(mdx)).toEqual([
			{ raw: "https://www.jknm.si/si/?id=623&l=2016", legacy_id: 623 },
		]);
	});

	it("also matches links with no &l= param", () => {
		const mdx = "[x](https://www.jknm.si/si/?id=402)";
		expect(find_legacy_id_refs(mdx)).toEqual([
			{ raw: "https://www.jknm.si/si/?id=402", legacy_id: 402 },
		]);
	});

	it("dedupes by raw url, keeping distinct urls with the same id separate", () => {
		const mdx = [
			"[a](https://www.jknm.si/si/?id=612&l=2022)",
			"[b](https://www.jknm.si/si/?id=612&l=2022)",
			"[c](https://www.jknm.si/si/?id=612)",
		].join(" ");
		expect(find_legacy_id_refs(mdx)).toEqual([
			{ raw: "https://www.jknm.si/si/?id=612&l=2022", legacy_id: 612 },
			{ raw: "https://www.jknm.si/si/?id=612", legacy_id: 612 },
		]);
	});

	it("ignores media links", () => {
		const mdx = "https://www.jknm.si/media/pdf/1055.pdf";
		expect(find_legacy_id_refs(mdx)).toEqual([]);
	});
});

describe("static_asset_key", () => {
	it("strips the domain, keeping the path as the bucket key", () => {
		expect(
			static_asset_key("https://www.jknm.si/media/pdf/1055_Slugova.pdf"),
		).toBe("media/pdf/1055_Slugova.pdf");
	});

	it("works for non-www and http variants too", () => {
		expect(static_asset_key("http://jknm.si/media/DK/b.pdf")).toBe(
			"media/DK/b.pdf",
		);
	});
});
