"use client";

import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { MenuIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Session } from "next-auth";
import {
	type ComponentProps,
	Fragment,
	useEffect,
	useMemo,
	useRef,
} from "react";
import { create } from "zustand";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
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
import type { EditableArticleRef } from "../article/new-adapter";
import { shell_store } from "./desktop-header";
import EditingButtons from "./editing-buttons";
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

export const mobile_nav_store = create<MobileNavStore>(() => ({
	open: false,
}));

export function useMobileNavOpen(): boolean {
	return mobile_nav_store((state) => state.open);
}

export function MobileHeader({
	published_article,
	session,
	className,
	...props
}: ComponentProps<"div"> & {
	published_article?: EditableArticleRef;
	session: Session | null;
}) {
	const sticky_navbar_ref = useRef<HTMLDivElement | null>(null);
	const md_breakpoint = useBreakpoint("md");

	useEffect(() => {
		if (md_breakpoint) {
			mobile_nav_store.setState({ open: false });
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
			<Link className="text-2xl font-bold" href="/">
				Jamarski klub Novo mesto
			</Link>
			<MobileSheet published_article={published_article} session={session} />
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

export function MobileSheet({
	published_article,
	session,
}: {
	published_article?: EditableArticleRef;
	session: Session | null;
}) {
	const open = useMobileNavOpen();
	const pathname = usePathname();

	const links: { title: string; href: string; active?: boolean }[] =
		useMemo(() => {
			return MOBILE_NAV_LINKS.map((link) => {
				if (pathname.includes(link.href)) {
					return { ...link, active: true };
				}

				return link;
			});
		}, [pathname]);

	return (
		<Sheet
			open={open}
			modal={false}
			onOpenChange={(new_state) => {
				mobile_nav_store.setState({ open: new_state });
			}}
		>
			<SheetTrigger asChild>
				<Button variant="outline" size="icon">
					<MenuIcon />
				</Button>
			</SheetTrigger>
			<SheetContent onOpenAutoFocus={(e) => e.preventDefault()}>
				<SheetHeader>
					<div className="flex w-full items-center justify-center">
						<SheetClose asChild>
							<Link href="/">
								<Logo className="w-32" />
							</Link>
						</SheetClose>
					</div>
					<div className="flex justify-end">
						<EditingButtons
							published_article={published_article}
							session={session}
						/>
					</div>
					<VisuallyHidden>
						<SheetTitle>Jamarski klub Novo mesto</SheetTitle>
						<SheetDescription>Mobile navigation bar</SheetDescription>
					</VisuallyHidden>
				</SheetHeader>
				<ScrollArea className="my-4 h-[calc(100vh-8rem)] pb-24 pl-6">
					<div className="flex w-full items-center justify-between pb-4 pt-2">
						<SearchIcon />
						<FacebookIcon />
						<YoutubeIcon />
						<ContactIcon />
						<IntranetIcon />
					</div>
					{links.map((link) => (
						<Fragment key={link.href}>
							<Link
								className="block"
								href={`/${link.href}`}
								onClick={() => {
									mobile_nav_store.setState({ open: false });
								}}
							>
								{link.title}
							</Link>
							{link.active && <div id="mobile-toc" />}
						</Fragment>
					))}
					<div className="mt-6 pr-6">
						<Sponsors compact />
					</div>
				</ScrollArea>
			</SheetContent>
		</Sheet>
	);
}
