"use client";

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Separator } from "~/components/ui/separator";
// import Logo from "~/assets/logo-barvni.svg";
import { page_gutter_variants } from "~/lib/page-variants";
import type { NavSection } from "~/lib/static-nav-sections";
import { cn } from "~/lib/utils";
import { HomeLink } from "./home-link";
import {
	ContactIcon,
	FacebookIcon,
	InstagramIcon,
	IntranetIcon,
	SearchIcon,
	YoutubeIcon,
} from "./icons";
import { Logo } from "./logo";
import { Navigation } from "./navigation";

export function DesktopHeader({
	className,
	editor_controls,
	nav_sections,
	...props
}: React.ComponentProps<"div"> & {
	/** Admin-only editor chrome, rendered opaquely so no `Session` reaches the client. */
	editor_controls: React.ReactNode;
	nav_sections: NavSection[];
}) {
	const header_ref = useRef<HTMLDivElement | null>(null);
	// Cosmetic only (background tint + mini logo) -- the nav row itself is
	// always `sticky`, so this never changes its position or the document's
	// layout, just how it's painted once scrolled past the hero.
	const [is_scrolled, set_is_scrolled] = useState(false);

	const handle_scroll = useCallback(() => {
		if (!header_ref.current) return;
		// TODO: + 2 is a hack for the separator
		set_is_scrolled(window.scrollY > header_ref.current.clientHeight + 2);
	}, []);

	useEffect(() => {
		handle_scroll();
		window.addEventListener("scroll", handle_scroll);
		return () => window.removeEventListener("scroll", handle_scroll);
	}, [handle_scroll]);

	return (
		<>
			<div
				ref={header_ref}
				className={cn(
					"relative flex h-45.5 w-full items-end justify-between py-4 backdrop-blur-sm",
					className,
				)}
				{...props}
			>
				<div
					className={cn("flex", page_gutter_variants({ max_width: "wide" }))}
				>
					<div className="flex-1 flex items-end gap-4 pb-1">
						<FacebookIcon />
						<YoutubeIcon />
						<InstagramIcon />
					</div>
					<div className="flex-1 flex items-center justify-center">
						<HomeLink>
							<Logo className="w-auto min-w-[290px]" />
						</HomeLink>
					</div>
					<div className="flex-1 flex flex-col items-end justify-between">
						<div className="flex justify-end">{editor_controls}</div>
						<div className="flex flex-col items-end gap-4 pb-4.5">
							{/* <NoviceAutocomplete detached="" /> */}
							<div className="flex items-center gap-4">
								<SearchIcon />
								<ContactIcon />
								<IntranetIcon />
							</div>
						</div>
					</div>
				</div>
			</div>
			<Separator />
			<div
				className={cn(
					"sticky top-0 z-40 flex w-full items-center py-4 backdrop-blur supports-backdrop-filter:bg-background/60",
					is_scrolled && "bg-white/80 transition-colors",
					className,
				)}
			>
				<div
					className={cn(
						"flex items-center",
						page_gutter_variants({ max_width: "wide" }),
					)}
				>
					<div className="flex flex-1 items-center">
						{is_scrolled && (
							<HomeLink
								className="flex items-center"
								style={{
									marginLeft:
										"max(-5rem, calc(-4px - max(0px, (100vw - 1280px) / 2)))",
								}}
							>
								<Logo className="h-8 w-auto" />
							</HomeLink>
						)}
					</div>
					<div className="flex flex-1 items-center justify-center">
						<Navigation sections={nav_sections} />
					</div>
					<div className="flex-1" />
				</div>
			</div>
		</>
	);
}
