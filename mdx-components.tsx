import type { MDXComponents } from "mdx/types";
import { TableOfContents } from "~/components/static/toc-scroll";
import type { ImageProps } from "next/image";
import Image from "next/image";
import React from "react";

function ImageWithCaption({
  caption,
  ...props
}: ImageProps & { caption?: React.ReactNode }) {
  return (
    <figure>
      <Image {...props} />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    TableOfContents,
    Image: ImageWithCaption,
    ...components,
  };
}
