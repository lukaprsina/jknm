/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import { visit } from "unist-util-visit";
import * as fs from "fs-extra";
import path from "path";

interface Heading {
  depth: number;
  value: string;
}

interface TocEntry {
  file: string;
  headings: Heading[];
}

const mdxDirectory = path.join(process.cwd(), "src/app/(static)");
const outputFilePath = path.join(process.cwd(), "toc.json");

const extractHeadings = async (filePath: string): Promise<Heading[]> => {
  const fileContent = await fs.readFile(filePath, "utf-8");
  const tree = unified().use(remarkParse).use(remarkMdx).parse(fileContent);

  const headings: Heading[] = [];

  visit(tree, "heading", (node: any) => {
    const depth = node.depth;
    const value = node.children
      .filter((child: any) => child.type === "text")
      .map((child: any) => child.value)
      .join("");
    headings.push({ depth, value });
  });

  return headings;
};

const generateToc = async () => {
  const toc: TocEntry[] = [];
  const directories = await fs.readdir(mdxDirectory);

  for (const dir of directories) {
    const pagePath = path.join(mdxDirectory, dir, "page.mdx");
    if (await fs.pathExists(pagePath)) {
      const headings = await extractHeadings(pagePath);
      toc.push({ file: pagePath, headings });
    }
  }

  await fs.writeJson(outputFilePath, toc, { spaces: 2 });
  console.log(`Table of Contents written to ${outputFilePath}`);
};

generateToc().catch((error) => {
  console.error("Error generating Table of Contents:", error);
});
