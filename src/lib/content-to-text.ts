import type { OutputBlockData } from "@editorjs/editorjs";
import { strip_html_to_text } from "./sanitize-html";

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
		.map((block) => strip_html_to_text((block.data as { text: string }).text))
		.join("\n");
}
