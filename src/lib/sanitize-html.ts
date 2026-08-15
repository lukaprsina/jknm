import { decode } from "html-entities";
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

// EditorJS's inline toolbar means any raw block text (H1 title, TOC
// headings, meta/JSON-LD titles, slug input) can carry the same tags
// `sanitize_inline_html` allows for rendering, plus HTML entities (`&nbsp;`,
// `&gt;`) from pasted content or forced whitespace. Contexts that want plain
// text rather than renderable HTML need both stripped: tags removed *and*
// entities decoded, since `sanitizeHtml` alone only decodes entities it
// considers safe to re-emit as literal characters (`&nbsp;` yes, `&gt;` no —
// decoding that could be misread as reopening a tag).
export function strip_html_to_text(html: string): string {
	return decode(sanitizeHtml(html, { allowedTags: [] })).trim();
}
