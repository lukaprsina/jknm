import type { OutputBlockData } from "@editorjs/editorjs";
import DOMPurify from "isomorphic-dompurify";
import { decode } from "html-entities";

const ALLOWED_BLOCKS = ["paragraph", "list", "quote"];

export function content_to_text(blocks?: OutputBlockData[]) {
  if (!blocks) return "";

  const filtered_blocks = blocks.filter((block) =>
    ALLOWED_BLOCKS.includes(block.type),
  );

  const sanitized_text = filtered_blocks
    .map((block) => {
      // if (block.type !== "paragraph") return undefined;
      const paragraph_data = block.data as { text: string };

      const clean = DOMPurify.sanitize(paragraph_data.text, {
        ALLOWED_TAGS: [],
      });

      return decode(clean);
    })
    .filter((text) => typeof text !== "undefined")
    .join("\n");

  return sanitized_text.slice(0, 1000);
}
