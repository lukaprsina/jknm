"use client";

import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { MenuIcon, TableOfContentsIcon } from "lucide-react";
import Link from "next/link";
import { type ComponentProps, type ReactNode, useEffect, useRef } from "react";
import { create } from "zustand";
import { useHasToc } from "~/components/toc/toc-store";
import { Button } from "~/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "~/components/ui/drawer";
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
import { cn } from "~/lib/utils";
import { shell_store } from "./desktop-header";
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

	useEffect(() => {
		if (md_breakpoint) {
			mobile_nav_store.setState({ open: false });
			mobile_toc_store.setState({ open: false });
			return;
		}

		if (!sticky_navbar_ref.current) return;

		shell_store.setState({
			navbar_height: sticky_navbar_ref.current.clientHeight,
		});
	}, [md_breakpoint]);

	return (
		<div
			ref={sticky_navbar_ref}
			className={cn(
				"fixed top-0 z-40 flex w-full items-center justify-between bg-white/90 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60",
				className,
			)}
			{...props}
		>
			<HomeLink className="text-2xl font-bold">
				Jamarski klub Novo mesto
			</HomeLink>
			<div className="flex items-center gap-2">
				{has_toc && <MobileTocSheet />}
				<MobileSheet editor_controls={editor_controls} />
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

export function MobileTocSheet() {
	const open = useMobileTocOpen();

	return (
		<Drawer
			open={open}
			onOpenChange={(new_state) => {
				mobile_toc_store.setState({ open: new_state });
				if (new_state) mobile_nav_store.setState({ open: false });
			}}
		>
			<DrawerTrigger asChild>
				<Button variant="outline" size="icon">
					<TableOfContentsIcon />
					<span className="sr-only">Na tej strani</span>
				</Button>
			</DrawerTrigger>
			<DrawerContent onOpenAutoFocus={(e) => e.preventDefault()}>
				<DrawerHeader>
					<DrawerTitle>Na tej strani</DrawerTitle>
					<VisuallyHidden>
						<DrawerDescription>Kazalo trenutne strani</DrawerDescription>
					</VisuallyHidden>
				</DrawerHeader>
				<div id="mobile-toc" className="px-4 pb-8" />
			</DrawerContent>
		</Drawer>
	);
}
