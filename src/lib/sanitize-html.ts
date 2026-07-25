import sanitizeHtml from "sanitize-html";

// EditorJS's inline toolbar (see components/editor/plugins.ts) only emits
// bold/italic/link/inline-code/marker tags — titles and headings render this
// as trusted-looking HTML via dangerouslySetInnerHTML, so it must be
// sanitized against anything wider (script injection via a crafted title).
//
// Uses `sanitize-html` rather than `isomorphic-dompurify`: the latter pulls
// in `jsdom` for its server-side path, and `jsdom`'s `html-encoding-sniffer`
// dependency requires an ESM-only module that Next's Turbopack production
// build can't `require()` — every article render 500'd on Vercel until this
// was swapped (`ERR_REQUIRE_ESM` on `@exodus/bytes/encoding-lite.js`).
export function sanitize_inline_html(html: string): string {
	return sanitizeHtml(html, {
		allowedTags: ["b", "i", "a", "code", "mark"],
		allowedAttributes: {
			a: ["href", "target", "rel", "class"],
			code: ["class"],
			mark: ["class"],
			b: ["class"],
			i: ["class"],
		},
	});
}
