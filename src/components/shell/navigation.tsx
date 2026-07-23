import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuList,
} from "~/components/ui/navigation-menu";
import type { NavSection } from "~/lib/static-nav-sections";
import { NavigationMenuTrigger } from "../navigation-menu-trigger";
import { ListItem } from "./header";

export function Navigation({ sections }: { sections: NavSection[] }) {
	return (
		<NavigationMenu className="z-50">
			<NavigationMenuList>
				{sections.map((section) => (
					<NavDropdown key={section.section} section={section} />
				))}
			</NavigationMenuList>
		</NavigationMenu>
	);
}

function NavDropdown({ section }: { section: NavSection }) {
	const { section: href, title, headings } = section;

	if (headings.length === 0) {
		return (
			<NavigationMenuItem value={href}>
				<NavigationMenuTrigger className="bg-transparent text-base" href={href}>
					{title}
				</NavigationMenuTrigger>
			</NavigationMenuItem>
		);
	}

	return (
		<NavigationMenuItem value={href}>
			<NavigationMenuTrigger
				className="bg-transparent text-base"
				href={href}
				hasContent
			>
				{title}
			</NavigationMenuTrigger>
			<NavigationMenuContent className="z-50">
				<ul className="grid w-[653px] p-6 lg:grid-cols-[.75fr_1fr]">
					<ListItem is_title list_title={<b>{title}</b>} href={`/${href}`} />
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
