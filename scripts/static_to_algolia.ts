import { algoliasearch as searchClient } from "algoliasearch";
import { env } from "~/env";
import { glob } from "glob";
import fs from "fs/promises";
import { unified } from "unified";
import remarkParse from "remark-parse";
import type { Content } from "mdast";
import path from "path";
import { is } from "unist-util-is";

function serializeNode(node: Content): string {
  switch (node.type) {
    case "heading":
      return `${"#".repeat(node.depth)} ${node.children.map(serializeNode).join("")}`;
    case "text":
      return node.value;
    // Handle other node types as needed
    default:
      return "";
  }
}

async function splitMarkdownByHeading(filePath: string): Promise<string[]> {
  const content = await fs.readFile(filePath, "utf-8");
  const processor = unified().use(remarkParse);
  const tree = processor.parse(content);

  const sections: string[] = [];
  let currentSection: string[] = [];

  tree.children.forEach((node) => {
    if (is(node, { type: "heading", depth: 2 })) {
      if (currentSection.length > 0) {
        sections.push(currentSection.join("\n"));
        currentSection = [];
      }
    }
    currentSection.push(serializeNode(node));
  });

  if (currentSection.length > 0) {
    sections.push(currentSection.join("\n"));
  }

  return sections;
}

async function main() {
  const client = searchClient(
    env.NEXT_PUBLIC_ALGOLIA_ID,
    env.ALGOLIA_ADMIN_KEY,
  );

  const mdxFiles = glob.sync("src/app/(static)/*/page.mdx");

  const objects = await Promise.all(
    mdxFiles.map(async (file) => {
      const sections = await splitMarkdownByHeading(file);
      const pageName = path.basename(path.dirname(file));
      return sections.map((section, i) => ({
        objectID: `${pageName}-${i}`,
        text: section,
      }));
    }),
  );

  const flattenedObjects = objects.flat();

  await client.saveObjects({
    indexName: "static_pages",
    objects: flattenedObjects,
  });

  console.log("done");
}

main().catch(console.error);
