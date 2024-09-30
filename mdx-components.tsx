import type { MDXComponents } from "mdx/types";
import { ImageWithCaption } from "~/components/image-with-caption";
import { TableOfContents } from "~/components/static/toc-scroll";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    TableOfContents,
    Image: ImageWithCaption,
    ...components,
  };
}
