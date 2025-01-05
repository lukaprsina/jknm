import { algoliasearch as searchClient } from "algoliasearch";
import { env } from "~/env";
import { promises as fs } from "fs";
import { glob } from "glob";

async function main() {
  const client = searchClient(
    env.NEXT_PUBLIC_ALGOLIA_ID,
    env.ALGOLIA_ADMIN_KEY,
  );

  const mdxFiles = glob.sync("src/app/(static)/*/page.mdx");

  const objects = await Promise.all(
    mdxFiles.map(async (file) => {
      const content = await fs.readFile(file, "utf-8");
      return { text: content };
    }),
  );

  await client.saveObjects({ indexName: "static_pages", objects });

  console.log("done");
}

main().catch(console.error);
