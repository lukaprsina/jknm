import { db } from "~/server/db";
import { publishedArticle, draftArticle } from "../drizzle/schema";

// Type for EditorJS block
interface ArticleBlock {
  type: string;
  [key: string]: any;
}

async function main() {
  // Helper to extract block types from article content
  function extractBlockTypes(content: any): Set<string> {
    const types = new Set<string>();
    if (content && Array.isArray(content.blocks)) {
      for (const block of content.blocks as ArticleBlock[]) {
        if (block && typeof block.type === "string") {
          types.add(block.type);
        }
      }
    }
    return types;
  }

  // Query published articles
  const published = await db
    .select({ content: publishedArticle.content })
    .from(publishedArticle);
  // Query draft articles
  const drafts = await db
    .select({ content: draftArticle.content })
    .from(draftArticle);

  // Collect all block types
  const blockTypes = new Set<string>();
  for (const row of [...published, ...drafts]) {
    let content = row.content;
    if (typeof content === "string") {
      try {
        content = JSON.parse(content);
      } catch {}
    }
    for (const t of extractBlockTypes(content)) {
      blockTypes.add(t);
    }
  }

  console.log("Block types:", Array.from(blockTypes));
}

await main();
