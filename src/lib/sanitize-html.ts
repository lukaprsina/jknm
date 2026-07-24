import DOMPurify from "isomorphic-dompurify";

// EditorJS's inline toolbar (see components/editor/plugins.ts) only emits
// bold/italic/link/inline-code/marker tags — titles and headings render this
// as trusted-looking HTML via dangerouslySetInnerHTML, so it must be
// sanitized against anything wider (script injection via a crafted title).
export function sanitize_inline_html(html: string): string {
	return DOMPurify.sanitize(html, {
		ALLOWED_TAGS: ["b", "i", "a", "code", "mark"],
		ALLOWED_ATTR: ["href", "target", "rel", "class"],
	});
}
