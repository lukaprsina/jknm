import { describe, expect, it } from "vitest";
import { extract_static_content_html, html_to_blocks } from "./html-to-blocks";

describe("extract_static_content_html", () => {
	it("returns the innerHTML of the <h1>'s parent, ignoring everything outside it", () => {
		const page_html = `<html><body><div id="shell"><nav>chrome</nav><div class="content"><h1>Zgodovina</h1><p>text</p></div></div></body></html>`;
		expect(extract_static_content_html(page_html)).toBe(
			"<h1>Zgodovina</h1><p>text</p>",
		);
	});

	it("throws when no <h1> is present", () => {
		expect(() => extract_static_content_html("<div>no heading</div>")).toThrow(
			/h1/i,
		);
	});
});

describe("html_to_blocks", () => {
	it("skips the leading <h1> (the draft is already seeded with one)", () => {
		const blocks = html_to_blocks("<h1>Zgodovina</h1><p>text</p>");
		expect(blocks).toEqual([{ type: "paragraph", data: { text: "text" } }]);
	});

	it("converts h2/h3 to header blocks, keeping inline html", () => {
		const blocks = html_to_blocks(
			"<h2>1962 <b>Ustanovitev</b></h2><h3>Pomembnejša odkritja</h3>",
		);
		expect(blocks).toEqual([
			{ type: "header", data: { text: "1962 <b>Ustanovitev</b>", level: 2 } },
			{ type: "header", data: { text: "Pomembnejša odkritja", level: 3 } },
		]);
	});

	it("converts <p> to a paragraph block, keeping inline links and sup", () => {
		const blocks = html_to_blocks(
			'<p>izvlekli 80 m<sup>3</sup> odpadkov (<a href="https://vsebina.jknm.org/media/pdf/x.pdf" target="_blank">opis</a>).</p>',
		);
		expect(blocks).toEqual([
			{
				type: "paragraph",
				data: {
					text: 'izvlekli 80 m<sup>3</sup> odpadkov (<a href="https://vsebina.jknm.org/media/pdf/x.pdf" target="_blank">opis</a>).',
				},
			},
		]);
	});

	it("converts <ul><li> to a list block using the nested-item shape @editorjs/list@2.0.9 expects", () => {
		const blocks = html_to_blocks(
			"<ul><li>Prvi <b>člen</b></li><li>Drugi člen</li></ul>",
		);
		expect(blocks).toEqual([
			{
				type: "list",
				data: {
					style: "unordered",
					items: [
						{ content: "Prvi <b>člen</b>", meta: {}, items: [] },
						{ content: "Drugi člen", meta: {}, items: [] },
					],
				},
			},
		]);
	});

	it("converts a <figure><picture><img>...<figcaption> into an image block, ignoring the avif <source>", () => {
		const blocks = html_to_blocks(
			'<figure><picture><source srcset="https://vsebina.jknm.org/x.avif" type="image/avif"><img src="https://vsebina.jknm.org/zgodovina/x.jpg" width="800" height="600"></picture><figcaption>Iz zapisnika (1962)</figcaption></figure>',
		);
		expect(blocks).toEqual([
			{
				type: "image",
				data: {
					caption: "Iz zapisnika (1962)",
					file: {
						url: "https://vsebina.jknm.org/zgodovina/x.jpg",
						width: 800,
						height: 600,
					},
				},
			},
		]);
	});

	it("defaults caption to an empty string when there's no <figcaption>", () => {
		const blocks = html_to_blocks(
			'<figure><img src="https://vsebina.jknm.org/x.jpg" width="10" height="10"></figure>',
		);
		expect(blocks).toHaveLength(1);
		expect((blocks[0]!.data as { caption: string }).caption).toBe("");
	});

	it("throws on an unrecognized top-level element instead of silently dropping content", () => {
		expect(() => html_to_blocks("<blockquote>x</blockquote>")).toThrow(
			/blockquote/i,
		);
	});

	it("converts a <table> to a table block, using thead as the heading row", () => {
		const blocks = html_to_blocks(
			"<table><thead><tr><th><b>Leto</b></th><th>Objava</th></tr></thead>" +
				'<tbody><tr><td>1982</td><td><a href="https://vsebina.jknm.org/x.pdf">članek</a></td></tr>' +
				"<tr><td>1987</td><td>Drugi</td></tr></tbody></table>",
		);
		expect(blocks).toEqual([
			{
				type: "table",
				data: {
					withHeadings: true,
					content: [
						["<b>Leto</b>", "Objava"],
						["1982", '<a href="https://vsebina.jknm.org/x.pdf">članek</a>'],
						["1987", "Drugi"],
					],
				},
			},
		]);
	});
});
