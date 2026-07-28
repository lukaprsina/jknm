import { describe, expect, it } from "vitest";
import {
	extract_legacy_media_paths,
	find_legacy_media_match,
	normalize_basename,
} from "./legacy-media-source";

describe("extract_legacy_media_paths", () => {
	it("finds and decodes media paths from html, deduped", () => {
		const html = `
			<img src="/media/img/novice/2008/01/1_gradbena%20jama.jpg" />
			<img src="/media/img/novice/2008/01/1_gradbena%20jama.jpg" />
			<a href="/media/img/novice/2024/07/radescica_02__13_.JPG">x</a>
		`;
		expect(extract_legacy_media_paths(html)).toEqual([
			"/media/img/novice/2008/01/1_gradbena jama.jpg",
			"/media/img/novice/2024/07/radescica_02__13_.JPG",
		]);
	});

	it("returns nothing when there are no media paths", () => {
		expect(extract_legacy_media_paths("<p>no images here</p>")).toEqual([]);
	});
});

describe("normalize_basename", () => {
	it("collapses sanitization differences to the same token", () => {
		expect(normalize_basename("radescica_02__13_.JPG")).toBe(
			normalize_basename("radescica_02_13.jpg"),
		);
	});

	it("keeps distinguishing digits apart", () => {
		expect(normalize_basename("slika_1.jpg")).not.toBe(
			normalize_basename("slika_10.jpg"),
		);
	});

	it("works on a full path or url, not just a bare filename", () => {
		expect(normalize_basename("/media/img/novice/2008/01/a.jpg")).toBe(
			normalize_basename("https://example.com/x/a.jpg"),
		);
	});
});

describe("find_legacy_media_match", () => {
	it("finds the one candidate matching after normalization", () => {
		const candidates = [
			"/media/img/novice/2024/07/radescica_02__13_.JPG",
			"/media/img/novice/2024/07/radescica_02__1_.JPG",
		];
		expect(
			find_legacy_media_match(
				"https://jknm-novice.example.com/x/radescica_02_13.jpg",
				candidates,
			),
		).toBe("/media/img/novice/2024/07/radescica_02__13_.JPG");
	});

	it("returns null when nothing matches", () => {
		expect(
			find_legacy_media_match("https://example.com/x/nope.jpg", [
				"/media/img/novice/2024/07/radescica_02__13_.JPG",
			]),
		).toBeNull();
	});

	it("returns null on an ambiguous match rather than guessing", () => {
		const candidates = [
			"/media/img/novice/2014/01/slika_1.jpg",
			"/media/img/novice/2014/02/slika_1.jpg",
		];
		expect(
			find_legacy_media_match("https://example.com/x/slika_1.jpg", candidates),
		).toBeNull();
	});
});
