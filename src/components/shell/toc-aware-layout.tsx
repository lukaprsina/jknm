"use client";

import type React from "react";
import { useHasToc } from "~/components/toc/toc-store";
import { cn } from "~/lib/utils";

/** Lays `#shell-aside` out as a sticky sidebar next to `main`, only taking
 * space once a `<TableOfContents>` on the page reports a non-empty TOC.
 *
 * `known_has_toc` is a route-level hint (`Shell`'s `has_toc` prop) for pages
 * that always render a `<TableOfContents>` -- it seeds the very first render
 * so the layout doesn't reserve zero space, then jump to reserving the
 * sidebar once `toc_visibility_store` catches up client-side. Without it, SSR
 * always renders `has_toc: false` (the store's default, since nothing sets it
 * until `<TableOfContents>`'s effect runs post-hydration), which is a visible
 * shift on every article page reload. */
export function TocAwareLayout({
	children,
	known_has_toc = false,
}: {
	children: React.ReactNode;
	known_has_toc?: boolean;
}) {
	const has_toc = useHasToc() || known_has_toc;

	return (
		<div className="flex w-full flex-1 justify-center gap-8 px-6 md:px-12">
			<div
				className={cn("hidden w-75 shrink-0", has_toc && "not_center:block")}
				aria-hidden
			/>
			<main id="shell-main" className="min-w-0 flex-1">
				{children}
			</main>
			<aside
				id="shell-aside"
				className={cn(
					// Height must be definite (not `h-fit`): the portaled
					// `<ScrollArea>` fills it with `h-full`, and Radix only
					// scrolls when that percentage resolves to a definite
					// height. `h-fit` left the viewport at content height and
					// the Root's `overflow: hidden` clipped the overflow
					// instead of scrolling -- long TOCs were cut off.
					"sticky top-24 hidden h-[calc(100vh-6rem)] w-[300px] shrink-0",
					has_toc && "md:block",
				)}
			/>
		</div>
	);
}
