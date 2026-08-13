import { describe, expect, it } from "vitest";
import {
	aws_fallback_url,
	count_concatenated_prefixes,
	find_stale_asset_urls,
	rewrite_urls,
	strip_concatenated_prefixes,
} from "./stale-media-refs";

const B2 = "https://jknm-novice.s3.eu-central-003.backblazeb2.com";
const AWS = "https://jknm.s3.eu-central-1.amazonaws.com";

describe("find_stale_asset_urls", () => {
	it("finds urls in image-block json and in inline href html alike", () => {
		const content = JSON.stringify({
			blocks: [
				{ type: "image", data: { file: { url: `${B2}/tabor-2024/a.jpg` } } },
				{
					type: "paragraph",
					data: { text: `see <a href="${AWS}/dk/b.pdf">DK7</a>` },
				},
			],
		});

		expect(find_stale_asset_urls(content)).toEqual([
			`${B2}/tabor-2024/a.jpg`,
			`${AWS}/dk/b.pdf`,
		]);
	});

	it("dedupes and leaves current gradivo urls alone", () => {
		const text = `${B2}/x.jpg ${B2}/x.jpg https://gradivo.jknm.org/uuid/original.jpg`;
		expect(find_stale_asset_urls(text)).toEqual([`${B2}/x.jpg`]);
	});

	it("does not let the closing quote or paren bleed into the url", () => {
		expect(find_stale_asset_urls(`href="${AWS}/a.pdf")`)).toEqual([
			`${AWS}/a.pdf`,
		]);
	});
});

describe("strip_concatenated_prefixes", () => {
	it("recovers the real url from a jknm.si-prefixed one", () => {
		const broken = `http://www.jknm.sihttps://jknm.s3.eu-central-1.amazonaws.com/a/b.pdf`;
		expect(strip_concatenated_prefixes(broken)).toBe(`${AWS}/a/b.pdf`);
	});

	it("leaves genuine jknm.si links untouched", () => {
		const real =
			"https://www.jknm.si/si/?id=304 and https://www.jknm.si/media/x.pdf";
		expect(strip_concatenated_prefixes(real)).toBe(real);
		expect(count_concatenated_prefixes(real)).toBe(0);
	});

	it("makes the recovered url findable by the stale-asset scan", () => {
		const broken = `<a href="http://www.jknm.sihttps://jknm.s3.eu-central-1.amazonaws.com/a/b.pdf">x</a>`;
		expect(find_stale_asset_urls(strip_concatenated_prefixes(broken))).toEqual([
			`${AWS}/a/b.pdf`,
		]);
	});
});

describe("aws_fallback_url", () => {
	it("swaps the dead backblaze host for aws, keeping the key", () => {
		expect(aws_fallback_url(`${B2}/tabor/slika_1.jpg`)).toBe(
			`${AWS}/tabor/slika_1.jpg`,
		);
	});

	it("returns null for a url already on aws", () => {
		expect(aws_fallback_url(`${AWS}/tabor/slika_1.jpg`)).toBeNull();
	});
});

describe("rewrite_urls", () => {
	it("substitutes every occurrence", () => {
		const map = new Map([[`${B2}/a.jpg`, "https://gradivo.jknm.org/1/o.jpg"]]);
		expect(rewrite_urls(`${B2}/a.jpg and ${B2}/a.jpg`, map)).toBe(
			"https://gradivo.jknm.org/1/o.jpg and https://gradivo.jknm.org/1/o.jpg",
		);
	});

	it("does not let a shorter url corrupt one it is a prefix of", () => {
		const map = new Map([
			[`${B2}/a.jpg`, "https://gradivo.jknm.org/1/o.jpg"],
			[`${B2}/a.jpg?v=2`, "https://gradivo.jknm.org/2/o.jpg"],
		]);
		expect(rewrite_urls(`${B2}/a.jpg?v=2`, map)).toBe(
			"https://gradivo.jknm.org/2/o.jpg",
		);
	});

	it("treats replacement keys as literals, not patterns", () => {
		const map = new Map([
			[`${B2}/a(1).jpg`, "https://gradivo.jknm.org/1/o.jpg"],
		]);
		expect(rewrite_urls(`${B2}/a(1).jpg`, map)).toBe(
			"https://gradivo.jknm.org/1/o.jpg",
		);
	});
});
