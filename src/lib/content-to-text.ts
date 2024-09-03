import DOMPurify from "isomorphic-dompurify";

import type { ArticleContentType } from "@acme/db/schema";

const ALLOWED_BLOCKS = ["paragraph", "list", "quote"];

export function content_to_text(content?: ArticleContentType) {
  if (!content) return undefined;

  const blocks = content.blocks.filter((block) =>
    ALLOWED_BLOCKS.includes(block.type),
  );

  const sanitized_text = blocks
    .map((block) => {
      if (block.type !== "paragraph") return undefined;
      const paragraph_data = block.data as { text: string };

      const clean = DOMPurify.sanitize(paragraph_data.text, {
        ALLOWED_TAGS: [],
      });

      return clean;
    })
    .filter((text) => typeof text !== "undefined")
    .join("\n");

  return sanitized_text.slice(0, 1000);
}
