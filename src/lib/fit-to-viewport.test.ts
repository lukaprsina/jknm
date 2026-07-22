import { describe, expect, test } from "vitest";
import { fitToViewport } from "./fit-to-viewport";

describe("fitToViewport", () => {
	test("scales down a portrait image constrained by height", () => {
		const result = fitToViewport(
			{ width: 800, height: 1600 },
			{ maxWidth: 1000, maxHeight: 900 },
		);

		expect(result).toEqual({ width: 450, height: 900 });
	});

	test("scales down a landscape image constrained by width", () => {
		const result = fitToViewport(
			{ width: 1600, height: 800 },
			{ maxWidth: 900, maxHeight: 1000 },
		);

		expect(result).toEqual({ width: 900, height: 450 });
	});

	test("scales down a square image uniformly", () => {
		const result = fitToViewport(
			{ width: 1000, height: 1000 },
			{ maxWidth: 400, maxHeight: 400 },
		);

		expect(result).toEqual({ width: 400, height: 400 });
	});

	test("does not upscale an image narrower than both bounds", () => {
		const result = fitToViewport(
			{ width: 300, height: 200 },
			{ maxWidth: 1200, maxHeight: 900 },
		);

		expect(result).toEqual({ width: 300, height: 200 });
	});

	test("image exactly matching bounds is left unchanged", () => {
		const result = fitToViewport(
			{ width: 500, height: 500 },
			{ maxWidth: 500, maxHeight: 500 },
		);

		expect(result).toEqual({ width: 500, height: 500 });
	});

	test("picks the tighter of the two axis constraints for a wide image constrained by height", () => {
		const result = fitToViewport(
			{ width: 2000, height: 400 },
			{ maxWidth: 1800, maxHeight: 300 },
		);

		expect(result).toEqual({ width: 1500, height: 300 });
	});
});
