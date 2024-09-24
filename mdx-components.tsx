import type { MDXComponents } from "mdx/types";
import { TableOfContents } from "~/components/static/toc-scroll";
import Image from "next/image";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    TableOfContents,
    Image,
    ...components,
  };
}
