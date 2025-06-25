import { db } from "~/server/db";
import { publishedArticle, draftArticle } from "../drizzle/schema";

// Type for EditorJS block
interface ArticleBlock {
  type: string;
  [key: string]: any;
}

async function main() {
  // Query published articles
  const published = await db.query.PublishedArticle.findMany();

  // Save published articles as JSON
  const fs = await import("fs/promises");
  await fs.writeFile(
    "articles.json",
    JSON.stringify(published, null, 2),
    "utf-8",
  );
}

await main();
