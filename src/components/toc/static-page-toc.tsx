"use client";

import type { Toc } from "@stefanprobst/rehype-extract-toc";
import { useMemo } from "react";
import { flatten_toc } from "~/lib/toc";
import { TableOfContents } from "./table-of-contents";

/** Adapts the nested `Toc` a static MDX page exports (via
 * `@stefanprobst/rehype-extract-toc`) into the shared flat `TocEntry[]`
 * shape and renders it. */
export function StaticPageToc({ toc }: { toc: Toc }) {
	const entries = useMemo(() => flatten_toc(toc), [toc]);
	return <TableOfContents entries={entries} />;
}
