import type { MDXComponents } from 'mdx/types'
import { TableOfContents } from "~/components/static/toc-scroll";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    TableOfContents,
    ...components,
  };
}