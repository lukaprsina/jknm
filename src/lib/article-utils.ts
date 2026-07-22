import sanitize_filename from "sanitize-filename";
import sanitizeHtml from "sanitize-html";
import { v4 as uuid4 } from "uuid";
import { format_date_for_url } from "./format-date";

// This module is imported from client components too (e.g. editing-buttons.tsx),
// so it can't pull in Node's `path` module -- a plain string split is all
// `path.parse().name`/`.ext` were doing here anyway.
export function convert_filename_to_url(dangerous_url: string) {
	const dot_index = dangerous_url.lastIndexOf(".");
	const name =
		dot_index > 0 ? dangerous_url.slice(0, dot_index) : dangerous_url;
	const ext = dot_index > 0 ? dangerous_url.slice(dot_index) : "";
	return convert_title_to_url(name) + ext;
}

export function convert_title_to_url(
	dangerous_url: string,
	fallback: () => string = uuid4,
) {
	const clean = sanitizeHtml(dangerous_url, {
		allowedTags: [],
	});

	const sanitized = sanitize_filename(clean, { replacement: "" });
	const replaced = sanitized
		.toLowerCase()
		.replace(/–/g, "-")
		.replace(/[čšž]/g, (match) => {
			switch (match) {
				case "č":
					return "c";
				case "š":
					return "s";
				case "ž":
					return "z";
				default:
					return match;
			}
		})
		.replace(/[^a-zA-Z0-9\-_\s]/g, "")
		// Replace spaces or sequences of spaces, underscores, or hyphens with a single hyphen
		.replace(/[\s-]+/g, "-")
		.replace(/_+/g, "_")
		// Remove leading or trailing hyphens
		.replace(/^-+|-+$/g, "")
		.replace(/^_+|_+$/g, "")
		.trim();

	// remove leading and trailing dashes and underscores
	const replaced_split = replaced
		.split(/[\s+]/g)
		.map((s) => s.trim())
		.filter((s) => s.length > 0);

	if (replaced_split.length === 0) return fallback();
	return replaced_split.join("-");
}

export function get_s3_published_directory(
	article_url: string,
	created_at: Date | number,
) {
	const date = new Date(created_at);
	return `${article_url}-${format_date_for_url(date)}`;
}

export function get_draft_article_link(id: string) {
	return `/uredi/${id}`;
}

export function get_published_article_link(slug: string) {
	return `/novica/${slug}`;
}
