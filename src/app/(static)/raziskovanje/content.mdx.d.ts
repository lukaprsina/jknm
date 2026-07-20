import type { Toc } from "@stefanprobst/rehype-extract-toc";
import type { MDXContent } from "mdx/types";
import type { Metadata } from "next";

declare const Content: MDXContent;
export default Content;
export const metadata: Metadata;
export const tableOfContents: Toc;
