"use client";

import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ChevronDownIcon, MenuIcon } from "lucide-react";
import Link from "next/link";
import {
	type ComponentProps,
	type ReactNode,
	useEffect,
	useRef,
} from "react";
import { create } from "zustand";
import { useHasToc, useMobileTocProgress } from "~/components/toc/toc-store";
import { Button } from "~/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "~/components/ui/sheet";
import { useBreakpoint } from "~/hooks/use-breakpoint";
import { useIsScrollTop } from "~/hooks/use-is-scroll-top";
import { cn } from "~/lib/utils";
import { shell_store, useNavbarHeight } from "./desktop-header";
import { HomeLink } from "./home-link";
import {
	ContactIcon,
	FacebookIcon,
	IntranetIcon,
	SearchIcon,
	YoutubeIcon,
} from "./icons";
import { Logo } from "./logo";
import { Sponsors } from "./sponsors";

export interface MobileNavStore {
	open: boolean;
}

/** Drives the hamburger sheet (site nav). Kept separate from
 * `mobile_toc_store` so the two sheets can't fight over the same open flag
 * -- they're independent triggers, mirroring how Vercel's docs site splits
 * "menu" from "on this page" instead of stacking both in one sheet. */
export const mobile_nav_store = create<MobileNavStore>(() => ({
	open: false,
}));

export function useMobileNavOpen(): boolean {
	return mobile_nav_store((state) => state.open);
}

export interface MobileTocStore {
	open: boolean;
}

/** Drives the "Na tej strani" sheet. See `mobile_nav_store` for why this
 * isn't just a second field on the same store. */
export const mobile_toc_store = create<MobileTocStore>(() => ({
	open: false,
}));

export function useMobileTocOpen(): boolean {
	return mobile_toc_store((state) => state.open);
}

export function MobileHeader({
	editor_controls,
	className,
	...props
}: ComponentProps<"div"> & {
	/** Admin-only editor chrome, rendered opaquely so no `Session` reaches the client. */
	editor_controls: ReactNode;
}) {
	const sticky_navbar_ref = useRef<HTMLDivElement | null>(null);
	const md_breakpoint = useBreakpoint("md");
	const has_toc = useHasToc();
	const navbar_height = useNavbarHeight();
	const is_top = useIsScrollTop();

	useEffect(() => {
		if (md_breakpoint) {
			mobile_nav_store.setState({ open: false });
			mobile_toc_store.setState({ open: false });
			return;
		}

		if (!sticky_navbar_ref.current) return;

		// Re-measured on `has_toc` too, since that's what permanently adds the
		// "Na tej strani" trigger row to the block's resting height. Expanding
		// that trigger does *not* need to re-trigger this: the expanded panel
		// is a floating overlay (`position: absolute`), so it never affects
		// `clientHeight` here -- see `MobileTocPopover` for why (matches
		// fumadocs' own popover, which floats over the page rather than
		// pushing it down).
		const height = sticky_navbar_ref.current.clientHeight;
		shell_store.setState({ navbar_height: height });
		// Kept in sync so `.prose` headings' `scroll-margin-top` (globals.css)
		// clears the sticky header when scrolling to an anchor link, whether
		// "Jamarski klub Novo mesto" wraps to one line (113px) or two (137px).
		document.documentElement.style.setProperty(
			"--mobile-header-height",
			`${height}px`,
		);
	}, [md_breakpoint, has_toc]);

	return (
		<div className={cn("md:hidden", className)} {...props}>
			<div style={{ height: navbar_height }} className="min-h-20" aria-hidden />
			<div ref={sticky_navbar_ref} className="fixed top-0 z-40 w-full">
				<div
					className={cn(
						"flex items-center justify-between px-6 py-4 transition-colors",
						!is_top &&
							"bg-white/90 backdrop-blur-sm supports-backdrop-filter:bg-background/60",
					)}
				>
					<HomeLink className="text-2xl font-bold">
						Jamarski klub Novo mesto
					</HomeLink>
					<MobileSheet editor_controls={editor_controls} />
				</div>
				{has_toc && <MobileTocPopover is_top={is_top} />}
			</div>
		</div>
	);
}

const MOBILE_NAV_LINKS = [
	{ title: "Zgodovina", href: "zgodovina" },
	{ title: "Raziskovanje", href: "raziskovanje" },
	{ title: "Publiciranje", href: "publiciranje" },
	{ title: "Varstvo", href: "varstvo" },
	{ title: "Klub", href: "klub" },
	{ title: "Arhiv novic", href: "arhiv" },
];

function NavSectionLabel({ children }: { children: ReactNode }) {
	return (
		<span className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
			{children}
		</span>
	);
}

export function MobileSheet({
	editor_controls,
}: {
	editor_controls: ReactNode;
}) {
	const open = useMobileNavOpen();

	return (
		<Sheet
			open={open}
			modal={false}
			onOpenChange={(new_state) => {
				mobile_nav_store.setState({ open: new_state });
				if (new_state) mobile_toc_store.setState({ open: false });
			}}
		>
			<SheetTrigger asChild>
				<Button variant="outline" size="icon">
					<MenuIcon />
					<span className="sr-only">Meni</span>
				</Button>
			</SheetTrigger>
			<SheetContent onOpenAutoFocus={(e) => e.preventDefault()}>
				<SheetHeader>
					<div className="flex w-full items-center justify-center">
						<SheetClose asChild>
							<HomeLink>
								<Logo className="w-32" />
							</HomeLink>
						</SheetClose>
					</div>
					<div className="flex justify-end">{editor_controls}</div>
					<VisuallyHidden>
						<SheetTitle>Jamarski klub Novo mesto</SheetTitle>
						<SheetDescription>Mobile navigation bar</SheetDescription>
					</VisuallyHidden>
				</SheetHeader>
				<ScrollArea className="my-4 h-[calc(100vh-8rem)]">
					<div className="flex flex-col gap-6 px-6 pb-8">
						<nav className="flex flex-col gap-1">
							<NavSectionLabel>Vsebina</NavSectionLabel>
							{MOBILE_NAV_LINKS.map((link) => (
								<Link
									key={link.href}
									href={`/${link.href}`}
									onClick={() => {
										mobile_nav_store.setState({ open: false });
									}}
									className="rounded-md px-2 py-2 text-base font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
								>
									{link.title}
								</Link>
							))}
						</nav>

						<Separator />

						<div className="flex flex-col gap-3">
							<NavSectionLabel>Povezave</NavSectionLabel>
							<div className="flex items-center justify-between px-1">
								<SearchIcon />
								<FacebookIcon />
								<YoutubeIcon />
								<ContactIcon />
								<IntranetIcon />
							</div>
						</div>

						<Separator />

						<Sponsors compact />
					</div>
				</ScrollArea>
			</SheetContent>
		</Sheet>
	);
}

function clamp(value: number, min: number, max: number): number {
	if (value < min) return min;
	if (value > max) return max;
	return value;
}

/** Small ring showing how far through the TOC the active heading is --
 * ported from fumadocs' `ProgressCircle` (`packages/radix-ui/src/layouts/
 * docs/page/slots/toc.tsx`). */
function ProgressCircle({
	value,
	className,
}: {
	/** 0-1 */
	value: number;
	className?: string;
}) {
	const size = 18;
	const stroke_width = 1.5;
	const radius = size / 2 - stroke_width;
	const circumference = 2 * Math.PI * radius;
	const progress = clamp(value, 0, 1) * circumference;

	return (
		<svg
			role="progressbar"
			viewBox={`0 0 ${size} ${size}`}
			aria-valuenow={Math.round(clamp(value, 0, 1) * 100)}
			aria-valuemin={0}
			aria-valuemax={100}
			style={{ width: size, height: size }}
			className={className}
		>
			<circle
				cx={size / 2}
				cy={size / 2}
				r={radius}
				fill="none"
				strokeWidth={stroke_width}
				className="stroke-current/25"
			/>
			<circle
				cx={size / 2}
				cy={size / 2}
				r={radius}
				fill="none"
				strokeWidth={stroke_width}
				stroke="currentColor"
				strokeDasharray={circumference}
				strokeDashoffset={circumference - progress}
				strokeLinecap="round"
				transform={`rotate(-90 ${size / 2} ${size / 2})`}
				className="transition-all"
			/>
		</svg>
	);
}

/** "On this page" as a row below the navbar whose panel floats over the
 * page -- ported from fumadocs' `TOCPopover` (same file as `ProgressCircle`
 * above). Unlike a naive `Collapsible`, the expanded content is
 * `position: absolute`: fumadocs' own trigger row keeps a fixed height
 * whether open or closed and its panel overlays the article rather than
 * pushing it down, which also sidesteps having to keep the header's
 * reserved spacer in sync with an animating height. The trigger doubles as
 * a reading-progress indicator: the ring fills as the active heading moves
 * through the TOC, and the label swaps from "Na tej strani" to the current
 * heading's title while collapsed. */
export function MobileTocPopover({ is_top }: { is_top: boolean }) {
	const open = useMobileTocOpen();
	const { entries, active_id } = useMobileTocProgress();
	const container_ref = useRef<HTMLDivElement>(null);

	const active_index = entries.findIndex((entry) => entry.id === active_id);
	const active_entry =
		active_index === -1 ? undefined : entries[active_index];
	const progress =
		entries.length === 0 ? 0 : (active_index + 1) / entries.length;
	const show_active_title = active_entry !== undefined && !open;
	// Matches fumadocs' `(!isNavTransparent || open)`: the trigger row stays
	// transparent while collapsed at the top of the page, and only picks up
	// the same tint the navbar uses once scrolled or expanded -- keeping it
	// in sync with `MobileHeader`'s own `!is_top` background so there's a
	// single shared paint, not two independently-approximated ones.
	const show_bg = !is_top || open;

	// Radix `Collapsible` has no built-in outside-click handling (unlike
	// `Dialog`/`Sheet`) -- fine for a normal accordion, but this one floats
	// over the page as an overlay, so it needs the same close-on-outside-tap
	// affordance a sheet gets for free. Mirrors fumadocs' own
	// `onClickOutside` in `TOCPopover`.
	useEffect(() => {
		if (!open) return;

		const on_click_outside = (e: MouseEvent) => {
			if (!(e.target instanceof HTMLElement)) return;
			if (container_ref.current?.contains(e.target)) return;
			mobile_toc_store.setState({ open: false });
		};

		window.addEventListener("click", on_click_outside);
		return () => window.removeEventListener("click", on_click_outside);
	}, [open]);

	return (
		<Collapsible
			ref={container_ref}
			open={open}
			onOpenChange={(new_state) => {
				mobile_toc_store.setState({ open: new_state });
				if (new_state) mobile_nav_store.setState({ open: false });
			}}
			// TODO: do we want border here?
			className={cn("relative w-full"/* , "border-t" */)}
		>
			<CollapsibleTrigger
				className={cn(
					"flex h-10 w-full items-center gap-2.5 px-6 text-start text-sm text-muted-foreground transition-colors focus-visible:outline-none",
					show_bg &&
						"bg-white/90 backdrop-blur-sm supports-backdrop-filter:bg-background/60",
				)}
			>
				<ProgressCircle
					value={progress}
					className={cn("shrink-0", open && "text-foreground")}
				/>
				<span className="grid flex-1 *:col-start-1 *:row-start-1 *:my-auto">
					<span
						className={cn(
							"truncate transition-[opacity,translate] duration-200",
							open && "text-foreground",
							show_active_title && "-translate-y-full opacity-0",
						)}
					>
						Na tej strani
					</span>
					<span
						className={cn(
							"truncate transition-[opacity,translate] duration-200",
							!show_active_title && "translate-y-full opacity-0",
						)}
					>
						{active_entry?.title}
					</span>
				</span>
				<ChevronDownIcon
					className={cn("shrink-0 transition-transform", open && "rotate-180")}
				/>
			</CollapsibleTrigger>
			<CollapsibleContent className="absolute inset-x-0 top-full z-10 overflow-hidden border-b bg-white/90 shadow-lg backdrop-blur-sm data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down supports-backdrop-filter:bg-background/60">
				<div id="mobile-toc" className="max-h-[50vh] overflow-y-auto px-6 py-2" />
			</CollapsibleContent>
		</Collapsible>
	);
}
