import type { MDXComponents } from "mdx/types";
import { ImageWithCaption } from "~/components/image-with-caption";
import { TableOfContents } from "~/components/static/toc-scroll";
import Link from "next/link";
import { type HTMLProps, type ReactNode } from "react";

function clean_children(children: ReactNode): ReactNode {
  if (!children) throw new Error("table children is undefined");

  return Array.isArray(children)
    ? children.filter((child) =>
        typeof child === "string" ? child.trim() : true,
      )
    : children;
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    table: ({ children, ...props }: HTMLProps<HTMLTableElement>) => (
      <table {...props}>{clean_children(children)}</table>
    ),
    thead: ({ children, ...props }: HTMLProps<HTMLTableSectionElement>) => (
      <thead {...props}>{clean_children(children)}</thead>
    ),
    tr: ({ children, ...props }: HTMLProps<HTMLTableRowElement>) => (
      <tr {...props}>{clean_children(children)}</tr>
    ),
    tbody: ({ children, ...props }: HTMLProps<HTMLTableSectionElement>) => (
      <tbody {...props}>{clean_children(children)}</tbody>
    ),
    strong: (props) => <b {...props} />,
    a: ({ href, ref: _, ...props }) => {
      if (typeof href === "undefined") throw new Error("href is undefined");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      return <Link href={href} {...props} />;
    },
    TableOfContents,
    Image: (props) => <ImageWithCaption {...props} />,
    ...components,
  };
}
