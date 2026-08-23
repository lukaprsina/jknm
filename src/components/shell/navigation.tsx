import Link from "next/link";
import React, { useState } from "react";
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	navigationMenuTriggerStyle,
} from "~/components/ui/navigation-menu";
import type { NavSection } from "~/lib/static-nav-sections";
import { cn } from "~/lib/utils";
import { NavigationMenuTrigger } from "../navigation-menu-trigger";
import { buttonVariants } from "../ui/button";

export function Navigation({ sections }: { sections: NavSection[] }) {
	// Controlled so a trigger's onClick can open its own dropdown directly
	// (see navigation-menu-trigger.tsx) instead of depending on Radix's
	// internal click handler, which touch taps can't reach.
	const [value, setValue] = useState("");

	return (
		<NavigationMenu
			className="z-50 w-full max-w-none"
			value={value}
			onValueChange={setValue}
		>
			<NavigationMenuList>
				{sections.map((section) => (
					<NavDropdown
						key={section.section}
						section={section}
						onOpenRequest={() => setValue(section.section)}
					/>
				))}
			</NavigationMenuList>
		</NavigationMenu>
	);
}

function NavDropdown({
	section,
	onOpenRequest,
}: {
	section: NavSection;
	onOpenRequest: () => void;
}) {
	const { section: href, title, headings } = section;

	if (headings.length === 0) {
		return <DesktopHeaderLink href={`/${href}`}>{title}</DesktopHeaderLink>;
	}

	return (
		<NavigationMenuItem value={href}>
			<NavigationMenuTrigger
				className="bg-transparent text-base"
				href={href}
				hasContent
				onOpenRequest={onOpenRequest}
			>
				{title}
			</NavigationMenuTrigger>
			<NavigationMenuContent className="z-50 w-full md:w-full">
				<ul className="grid w-full gap-1 p-6">
					<ListItem list_title={<b>{title}</b>} href={`/${href}`} />
					{headings.map((heading) => (
						<ListItem
							key={heading.id}
							list_title={heading.title}
							href={`/${href}#${heading.id}`}
						/>
					))}
				</ul>
			</NavigationMenuContent>
		</NavigationMenuItem>
	);
}

export function DesktopHeaderLink({
	href,
	children,
}: {
	href: string;
	children: React.ReactNode;
}) {
	return (
		<NavigationMenuItem>
			<NavigationMenuLink asChild>
				<Link
					href={href}
					className={cn(
						navigationMenuTriggerStyle(),
						"bg-transparent text-base dark:bg-primary/80 dark:text-primary-foreground",
					)}
				>
					{children}
				</Link>
			</NavigationMenuLink>
		</NavigationMenuItem>
	);
}

export const ListItem = React.forwardRef<
	React.ComponentRef<"a">,
	React.ComponentPropsWithoutRef<"a"> & {
		list_title?: React.ReactNode;
	}
>(({ className, list_title, href, ...props }, ref) => {
	if (!href) {
		return null;
	}

	return (
		<li>
			<NavigationMenuLink asChild>
				<Link
					href={href}
					ref={ref}
					className={cn(
						"prose",
						buttonVariants({ size: "sm", variant: "link" }),
						"w-full justify-start text-left",
						className,
					)}
					{...props}
				>
					{list_title}
				</Link>
			</NavigationMenuLink>
		</li>
	);
});
ListItem.displayName = "ListItem";
