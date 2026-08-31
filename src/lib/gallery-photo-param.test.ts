import { describe, expect, it } from "vitest";
import { decode_photo_param, encode_photo_param } from "./gallery-photo-param";

const CDN = "https://gradivo.jknm.org";

describe("encode_photo_param", () => {
	it("strips the CDN origin from a CDN-hosted url", () => {
		expect(encode_photo_param(`${CDN}/abc-123/original.jpg`)).toBe(
			"abc-123/original.jpg",
		);
	});

	it("leaves a non-CDN url untouched", () => {
		expect(encode_photo_param("https://example.com/a.jpg")).toBe(
			"https://example.com/a.jpg",
		);
	});
});

describe("decode_photo_param", () => {
	it("reconstructs a CDN-relative path back into a full url", () => {
		expect(decode_photo_param("abc-123/original.jpg")).toBe(
			`${CDN}/abc-123/original.jpg`,
		);
	});

	it("leaves a full url untouched", () => {
		expect(decode_photo_param("https://example.com/a.jpg")).toBe(
			"https://example.com/a.jpg",
		);
	});

	it("round-trips with encode_photo_param", () => {
		const original = `${CDN}/abc-123/original.jpg`;
		expect(decode_photo_param(encode_photo_param(original))).toBe(original);
	});
});
