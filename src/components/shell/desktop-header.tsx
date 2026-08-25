"use client";

import type React from "react";
import { useCallback, useEffect, useRef } from "react";
import { create } from "zustand";
import { Separator } from "~/components/ui/separator";
import { useBreakpoint } from "~/hooks/use-breakpoint";
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

export interface ShellStore {
	is_header_sticky: boolean;
	navbar_height: number | undefined;
}

export const shell_store = create<ShellStore>(() => ({
	is_header_sticky: false,
	navbar_height: undefined,
}));

export function useIsHeaderSticky(): boolean {
	return shell_store((state) => state.is_header_sticky);
}

export function useNavbarHeight(): number | undefined {
	return shell_store((state) => state.navbar_height);
}

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
	const sticky_navbar_ref = useRef<HTMLDivElement | null>(null);
	const header_ref = useRef<HTMLDivElement | null>(null);
	const is_header_sticky = useIsHeaderSticky();
	const navbar_height = useNavbarHeight();
	const lg_breakpoint = useBreakpoint("lg");

	const handle_scroll = useCallback(() => {
		if (!header_ref.current) return;

		// TODO: + 2 is a hack for the separator
		const should_be_sticky =
			window.scrollY > header_ref.current.clientHeight + 2;

		if (should_be_sticky !== shell_store.getState().is_header_sticky) {
			shell_store.setState({ is_header_sticky: should_be_sticky });
		}
	}, []);

	useEffect(() => {
		if (!sticky_navbar_ref.current) return;

		if (lg_breakpoint) {
			shell_store.setState({
				navbar_height: sticky_navbar_ref.current.clientHeight,
			});
		}
	}, [lg_breakpoint]);

	useEffect(() => {
		window.addEventListener("scroll", handle_scroll);

		return () => {
			window.removeEventListener("scroll", handle_scroll);
		};
	}, [handle_scroll]);

	// activate on mount
	useEffect(() => {
		handle_scroll();
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
			<Separator
				style={{
					marginBottom: is_header_sticky ? navbar_height : "",
				}}
			/>
			<div
				ref={sticky_navbar_ref}
				className={cn(
					"relative z-40 flex w-full items-center py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60",
					is_header_sticky ? "fixed top-0 bg-white/80 transition-colors" : null,
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
						{is_header_sticky && (
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
