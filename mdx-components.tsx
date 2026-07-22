import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import type { HTMLProps, ReactNode } from "react";
import { ImageWithCaption } from "~/components/image-with-caption";

// Heading ids are handled by `rehype-slug` in the MDX pipeline (see
// next.config.mjs), which sets `id` in the hast tree before this file ever
// runs -- so h1-h6 need no override here, the `id` prop just passes through.
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

			return <Link target="_blank" href={href} {...props} />;
		},
		Image: (props) => <ImageWithCaption {...props} />,
		...components,
	};
}

function clean_children(children: ReactNode): ReactNode {
	if (!children) throw new Error("table children is undefined");

	return Array.isArray(children)
		? children.filter((child) =>
				typeof child === "string" ? child.trim() : true,
			)
		: children;
}
