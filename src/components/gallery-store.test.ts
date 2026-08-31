import { beforeEach, describe, expect, test } from "vitest";
import type { EditorJSImageData } from "~/lib/editor-utils";
import { gallery_store } from "./gallery-store";

function make_image(url: string): EditorJSImageData {
	return { caption: url, file: { url } };
}

beforeEach(() => {
	gallery_store.setState({ images: [] });
});

describe("registerImages", () => {
	test("replaces the full image set", () => {
		gallery_store.getState().registerImages([make_image("a"), make_image("b")]);
		expect(gallery_store.getState().images.map((i) => i.file.url)).toEqual([
			"a",
			"b",
		]);

		gallery_store.getState().registerImages([make_image("c")]);
		expect(gallery_store.getState().images.map((i) => i.file.url)).toEqual([
			"c",
		]);
	});

	test("replaces a previous article's images entirely (no leak across navigation)", () => {
		gallery_store.getState().registerImages([make_image("article-1-a")]);
		gallery_store.getState().registerImages([make_image("article-2-a")]);

		expect(gallery_store.getState().images.map((i) => i.file.url)).toEqual([
			"article-2-a",
		]);
	});

	test("dedups by url within the given set", () => {
		gallery_store
			.getState()
			.registerImages([make_image("a"), make_image("a"), make_image("b")]);

		expect(gallery_store.getState().images.map((i) => i.file.url)).toEqual([
			"a",
			"b",
		]);
	});
});

describe("addImage / removeImage", () => {
	test("addImage appends without duplicating an existing url", () => {
		gallery_store.getState().addImage(make_image("a"));
		gallery_store.getState().addImage(make_image("a"));
		gallery_store.getState().addImage(make_image("b"));

		expect(gallery_store.getState().images.map((i) => i.file.url)).toEqual([
			"a",
			"b",
		]);
	});

	test("removeImage removes only the matching url", () => {
		gallery_store.getState().addImage(make_image("a"));
		gallery_store.getState().addImage(make_image("b"));
		gallery_store.getState().removeImage("a");

		expect(gallery_store.getState().images.map((i) => i.file.url)).toEqual([
			"b",
		]);
	});
});
