import { useState } from "react";
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuList,
} from "~/components/ui/navigation-menu";
import type { NavSection } from "~/lib/static-nav-sections";
import { NavigationMenuTrigger } from "../navigation-menu-trigger";
import { DesktopHeaderLink, ListItem } from "./header";

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
