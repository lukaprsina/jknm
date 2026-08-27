import { describe, expect, it } from "vitest";
import { resolve_legacy_static_path } from "./legacy-si-paths";

describe("resolve_legacy_static_path", () => {
	it.each([
		[["klub"], "/klub"],
		[["klub", "interes"], "/klub"],
		[["klub", "povezave"], "/klub"],
		[["klub", "zgodovina"], "/zgodovina"],
		[["klub", "zgodovina", "1962"], "/zgodovina"],
		[["publikacije"], "/publiciranje"],
		[["publikacije", "kras01"], "/publiciranje"],
		[["raziskovanje"], "/raziskovanje"],
		[["raziskovanje", "kanin"], "/raziskovanje"],
		[["varstvo"], "/varstvo"],
		[["etc", "kontakt"], "/stik-z-nami"],
		[["etc", "iskanje"], "/arhiv"],
	])("redirects %j to %s", (segments, path) => {
		expect(resolve_legacy_static_path(segments)).toEqual({
			outcome: "redirect",
			path,
		});
	});

	it.each([
		[["jame"]],
		[["jame", "naj", "najgloblje.htm"]],
		[["kataster"]],
		[["kataster", "jknm"]],
		[["jrs"]],
		[["izobrazevanje"]],
		[["navodila"]],
		[["download"]],
		[["etc", "clani"]],
		[["etc", "impresum"]],
		[["varnost", "piskotki"]],
		[["unknown-section"]],
		[[]],
	])("marks %j as gone", (segments) => {
		expect(resolve_legacy_static_path(segments)).toEqual({ outcome: "gone" });
	});
});
