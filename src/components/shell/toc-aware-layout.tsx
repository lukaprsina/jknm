"use client";

import type React from "react";
import { useHasToc } from "~/components/toc/toc-store";
import { cn } from "~/lib/utils";

/** Lays `#shell-aside` out as a sticky sidebar next to `main`, only taking
 * space once a `<TableOfContents>` on the page reports a non-empty TOC. */
export function TocAwareLayout({ children }: { children: React.ReactNode }) {
	const has_toc = useHasToc();

	return (
		<div className="flex w-full justify-center gap-8">
			<main id="shell-main" className="min-w-0 flex-1">
				{children}
			</main>
			<aside
				id="shell-aside"
				className={cn(
					"sticky top-24 hidden h-fit max-h-[calc(100vh-6rem)] w-[300px] shrink-0 overflow-y-auto",
					has_toc && "md:block",
				)}
			/>
		</div>
	);
}
