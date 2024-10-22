import type { MDXComponents } from "mdx/types";
import { ImageWithCaption } from "~/components/image-with-caption";
import { TableOfContents } from "~/components/static/toc-scroll";
import Link from "next/link";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    strong: (props) => <b {...props} />,
    a: ({ href, ...props }) => {
      if (typeof href === "undefined") throw new Error("href is undefined");
      return <Link href={href} {...props} />;
    },
    TableOfContents,
    Image: ImageWithCaption,
    ...components,
  };
}
