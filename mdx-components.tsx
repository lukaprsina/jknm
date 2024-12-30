import type { MDXComponents } from "mdx/types";
import { ImageWithCaption } from "~/components/image-with-caption";
import { TableOfContents } from "~/components/static/toc-scroll";
import Link from "next/link";
import React, { type HTMLProps, type ReactNode } from "react";
import slugify from "slugify";

function clean_children(children: ReactNode): ReactNode {
  if (!children) throw new Error("table children is undefined");

  return Array.isArray(children)
    ? children.filter((child) =>
        typeof child === "string" ? child.trim() : true,
      )
    : children;
}

function HeadingWithSlug({
  level,
  children,
  ...props
}: HTMLProps<HTMLHeadingElement> & { level: number }) {
  const id = slugify(
    React.Children.toArray(children)
      .filter((child) => typeof child === "string")
      .join(" "),
    { lower: true, strict: true },
  );

  switch (level) {
    case 1:
      return (
        <h1 id={id} {...props}>
          {children}
        </h1>
      );
    case 2:
      return (
        <h2 id={id} {...props}>
          {children}
        </h2>
      );
    case 3:
      return (
        <h3 id={id} {...props}>
          {children}
        </h3>
      );
    case 4:
      return (
        <h4 id={id} {...props}>
          {children}
        </h4>
      );
    case 5:
      return (
        <h5 id={id} {...props}>
          {children}
        </h5>
      );
    case 6:
      return (
        <h6 id={id} {...props}>
          {children}
        </h6>
      );
    default:
      throw new Error("Invalid heading level");
  }
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
      return <Link target="_blank" href={href} {...props} />;
    },
    TableOfContents,
    Image: (props) => <ImageWithCaption {...props} />,
    h1: (props: HTMLProps<HTMLHeadingElement>) => (
      <HeadingWithSlug {...props} level={1} />
    ),
    h2: (props: HTMLProps<HTMLHeadingElement>) => (
      <HeadingWithSlug {...props} level={2} />
    ),
    h3: (props: HTMLProps<HTMLHeadingElement>) => (
      <HeadingWithSlug {...props} level={3} />
    ),
    h4: (props: HTMLProps<HTMLHeadingElement>) => (
      <HeadingWithSlug {...props} level={4} />
    ),
    h5: (props: HTMLProps<HTMLHeadingElement>) => (
      <HeadingWithSlug {...props} level={5} />
    ),
    h6: (props: HTMLProps<HTMLHeadingElement>) => (
      <HeadingWithSlug {...props} level={6} />
    ),
    ...components,
  };
}
