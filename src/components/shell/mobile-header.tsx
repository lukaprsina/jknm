"use client";

import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ChevronDownIcon, MenuIcon } from "lucide-react";
import { motion, useMotionValue, useTransform } from "motion/react";
import Link from "next/link";
import {
	type ComponentProps,
	type ReactNode,
	useEffect,
	useLayoutEffect,
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
import { clamp } from "~/hooks/header-scroll-state";
import { useBreakpoint } from "~/hooks/use-breakpoint";
import { useHeaderHiddenAmount } from "~/hooks/use-header-hidden-amount";
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
	nav_sections,
	known_has_toc = false,
	className,
	...props
}: ComponentProps<"div"> & {
	/** Admin-only editor chrome, rendered opaquely so no `Session` reaches the client. */
	editor_controls: ReactNode;
	nav_sections: NavSection[];
	/** Route-level hint (`Shell`'s `has_toc` prop, same one `TocAwareLayout`
	 * takes as `known_has_toc`) for pages that always render a
	 * `<TableOfContents>`. Seeds the very first render so the TOC trigger row
	 * and `--mobile-header-height` are correct immediately, instead of
	 * popping in once `toc_visibility_store` catches up post-hydration. */
	known_has_toc?: boolean;
}) {
	const sticky_navbar_ref = useRef<HTMLDivElement | null>(null);
	const title_row_ref = useRef<HTMLDivElement | null>(null);
	const lg_breakpoint = useBreakpoint("lg");
	const has_toc = useHasToc() || known_has_toc;

	// Measures the title row alone -- the TOC trigger row is a separate,
	// always-visible sibling below it, not part of what `hidden` hides.
	// Starts at the one-line height (32px padding + 40px icon button) instead
	// of `0`: the title only wraps below ~350px viewport width, so this is
	// correct in the server-rendered HTML too, before the `ResizeObserver`
	// below gets a chance to measure it for real.
	const title_height = useMotionValue(72);
	useLayoutEffect(() => {
		const el = title_row_ref.current;
		if (!el) return;

		title_height.set(el.getBoundingClientRect().height);

		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (entry) title_height.set(entry.contentRect.height);
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, [title_height]);

	// Continuous px-hidden value driven straight off scroll -- see
	// `use-header-hidden-amount.ts`. Only the title row is translated by
	// `-hidden`; `spacer_height` reclaims the layout space it leaves behind,
	// since `transform` doesn't do that on its own. `overflowAnchor: "none"`
	// on the spacer keeps the browser's scroll-anchoring from "correcting"
	// `scrollY` in response to that resize, which would otherwise feed back
	// into `hidden` and produce a runaway oscillation.
	const hidden = useHeaderHiddenAmount(title_height);
	const spacer_height = useTransform(
		[title_height, hidden],
		([max, amount]) => Math.max((max as number) - (amount as number), 0),
	);
	const translate_y = useTransform(
		hidden,
		(amount) => `translateY(-${amount}px)`,
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: has_toc isn't read here, but it changes the DOM layout that clientHeight measures below -- see comment inside.
	useEffect(() => {
		if (lg_breakpoint) {
			mobile_nav_store.setState({ open: false });
			mobile_toc_store.setState({ open: false });
			return;
		}

		if (!sticky_navbar_ref.current) return;

		// Kept in sync so `.prose` headings' `scroll-margin-top` (globals.css)
		// clears the sticky header when scrolling to an anchor link. Read at
		// mount/breakpoint-change time, while the header is still fully shown,
		// so mid-scroll hiding doesn't affect it.
		document.documentElement.style.setProperty(
			"--mobile-header-height",
			`${sticky_navbar_ref.current.clientHeight}px`,
		);
	}, [lg_breakpoint, has_toc]);

	return (
		// `contents`: same containing-block starvation issue as `<header>` in
		// `shell/index.tsx` -- a boxed wrapper here would starve the sticky
		// navbar of room to stay pinned.
		<div className={cn("contents lg:hidden", className)} {...props}>
			<div ref={sticky_navbar_ref} className="sticky top-0 z-40 w-full">
				<motion.div
					style={{ height: spacer_height, overflowAnchor: "none" }}
					aria-hidden
				/>
				<motion.div
					ref={title_row_ref}
					className="absolute inset-x-0 top-0"
					style={{ transform: translate_y }}
				>
					<div className="flex items-center justify-between bg-white/90 px-6 py-4 backdrop-blur-sm supports-backdrop-filter:bg-background/60">
						<HomeLink className="text-xl font-bold min-[450px]:text-2xl">
							Jamarski klub Novo mesto
						</HomeLink>
						<MobileSheet
							editor_controls={editor_controls}
							nav_sections={nav_sections}
						/>
					</div>
				</motion.div>
				{has_toc && <MobileTocPopover />}
			</div>
		</div>
	);
}

function NavSectionLabel({ children }: { children: ReactNode }) {
	return (
		<span className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
			{children}
		</span>
	);
}

export function MobileSheet({
	editor_controls,
	nav_sections,
}: {
	editor_controls: ReactNode;
	nav_sections: NavSection[];
}) {
	const open = useMobileNavOpen();
	const close_nav = () => mobile_nav_store.setState({ open: false });

	return (
		<Sheet
			open={open}
			onOpenChange={(new_state) => {
				mobile_nav_store.setState({ open: new_state });
				if (new_state) mobile_toc_store.setState({ open: false });
			}}
		>
			<SheetTrigger asChild>
				<Button variant="outline" size="icon" className="shrink-0">
					<MenuIcon />
					<span className="sr-only">Meni</span>
				</Button>
			</SheetTrigger>
			<SheetContent
				onOpenAutoFocus={(e) => e.preventDefault()}
				className="flex flex-col"
			>
				<SheetHeader className="shrink-0">
					<div className="flex w-full items-center justify-start pl-8">
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
				<ScrollArea className="my-4 min-h-0 flex-1">
					<div className="flex flex-col gap-6 px-6 pb-8">
						<nav className="flex flex-col gap-1">
							<NavSectionLabel>Vsebina</NavSectionLabel>
							{nav_sections.map((section) => (
								<Link
									key={section.section}
									href={`/${section.section}`}
									onClick={() => {
										mobile_nav_store.setState({ open: false });
									}}
									className="rounded-md px-2 py-2 text-base font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
								>
									{section.title}
								</Link>
							))}
						</nav>

						<Separator />

						<div className="flex flex-col gap-3">
							<NavSectionLabel>Povezave</NavSectionLabel>
							<div className="flex items-center justify-between px-1">
								<SearchIcon onNavigate={close_nav} />
								<FacebookIcon onNavigate={close_nav} />
								<YoutubeIcon onNavigate={close_nav} />
								<InstagramIcon onNavigate={close_nav} />
								<ContactIcon onNavigate={close_nav} />
								<IntranetIcon onNavigate={close_nav} />
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
export function MobileTocPopover() {
	const open = useMobileTocOpen();
	const { entries, active_id } = useMobileTocProgress();
	const container_ref = useRef<HTMLDivElement>(null);

	const active_index = entries.findIndex((entry) => entry.id === active_id);
	const active_entry = active_index === -1 ? undefined : entries[active_index];
	const progress =
		entries.length === 0 ? 0 : (active_index + 1) / entries.length;
	const show_active_title = active_entry !== undefined && !open;

	// Radix `Collapsible` has no built-in outside-click handling (unlike
	// `Dialog`/`Sheet`) -- fine for a normal accordion, but this one floats
	// over the page as an overlay, so it needs the same close-on-outside-tap
	// affordance a sheet gets for free. Mirrors fumadocs' own
	// `onClickOutside` in `TOCPopover`.
	useEffect(() => {
		if (!open) return;

		const on_pointer_down_outside = (e: PointerEvent) => {
			if (!(e.target instanceof HTMLElement)) return;
			if (container_ref.current?.contains(e.target)) return;
			mobile_toc_store.setState({ open: false });
		};

		window.addEventListener("pointerdown", on_pointer_down_outside);
		return () =>
			window.removeEventListener("pointerdown", on_pointer_down_outside);
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
			className={cn("relative w-full" /* , "border-t" */)}
		>
			<CollapsibleTrigger className="flex h-10 w-full items-center gap-2.5 bg-white/90 px-6 text-start text-sm text-muted-foreground backdrop-blur-sm transition-colors focus-visible:outline-none supports-backdrop-filter:bg-background/60">
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
				<div
					id="mobile-toc"
					className="max-h-[50vh] overflow-y-auto px-6 py-2"
				/>
			</CollapsibleContent>
		</Collapsible>
	);
}
