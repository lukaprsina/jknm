import { asc } from "drizzle-orm";
import { db } from "~/server/db";
import { PublishedArticle } from "~/server/db/schema";

async function main() {
  // Query published articles
  const published = await db.query.PublishedArticle.findMany({
    orderBy: asc(PublishedArticle.id)
  });

  // Save published articles as JSON
  const fs = await import("fs/promises");
  await fs.writeFile(
    "scripts/articles.json",
    JSON.stringify(published, null, 2),
    "utf-8",
  );
}

await main();
