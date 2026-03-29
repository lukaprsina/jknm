import type { OutputBlockData } from "@editorjs/editorjs";
import sanitizeHtml from "sanitize-html";
import { decode } from "html-entities";

const ALLOWED_BLOCKS = ["paragraph", "list", "quote"];

export function convert_content_to_text(
	blocks?: OutputBlockData[],
	only_allowed = true,
) {
	if (!blocks) return "";

	const filtered_blocks = only_allowed
		? blocks.filter((block) => ALLOWED_BLOCKS.includes(block.type))
		: blocks;

	return filtered_blocks
		.map((block) => {
			const paragraph_data = block.data as { text: string };

			const clean = sanitizeHtml(paragraph_data.text, {
				allowedTags: [],
			});

			return decode(clean);
		})
		.filter((text) => typeof text !== "undefined")
		.join("\n");
}
