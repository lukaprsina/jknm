import Link from "next/link";
import slugify from "slugify";
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuList,
} from "~/components/ui/navigation-menu";
import toc from "~/toc.json";
import { NavigationMenuTrigger } from "../navigation-menu-trigger";
import { ListItem } from "./header";

const SORTED_SECTIONS = [
	"zgodovina",
	"raziskovanje",
	"publiciranje",
	"varstvo",
	"klub",
	"arhiv",
];

export function Navigation() {
	const mapped_toc = toc.map((item) => {
		const section = item.file.split("\\").slice(-2, -1)[0];

		if (!section) throw new Error("TOC: No section found");

		return { section, headings: item.headings };
	});

	mapped_toc.push({
		section: "arhiv",
		headings: [],
	});

	const sorted_toc = SORTED_SECTIONS.map((section) => {
		const item = mapped_toc.find((item) => item.section === section);

		if (!item) throw new Error(`TOC: Section not found: ${section}`);

		return item;
	});

	return (
		<NavigationMenu className="z-50">
			<NavigationMenuList>
				{sorted_toc.map((item) => {
					let uppercase =
						item.section.charAt(0).toUpperCase() + item.section.slice(1);

					// TODO: ugly hack
					if (item.section === "arhiv") {
						uppercase = "Arhiv novic";
					}
					return (
						<NavDropdown
							key={item.section}
							title={uppercase}
							href={item.section}
							headings={item.headings
								.filter((heading) => heading.depth === 2)
								.map((heading) => heading.value)}
						/>
					);
				})}
			</NavigationMenuList>
		</NavigationMenu>
	);
}

function NavDropdown({
	title,
	href,
	headings,
}: {
	title: string;
	href: string;
	headings: string[];
}) {
	// console.log({ title, href, headings });

	if (headings.length === 0) {
		return (
			<NavigationMenuItem value={href}>
				<NavigationMenuTrigger className="bg-transparent text-base">
					<Link href={`/${href}`}>{title}</Link>
				</NavigationMenuTrigger>
			</NavigationMenuItem>
		);
	}

	return (
		<NavigationMenuItem value={href}>
			<NavigationMenuTrigger className="bg-transparent text-base">
				{title}
			</NavigationMenuTrigger>
			<NavigationMenuContent className="z-50">
				<ul className="grid w-[653px] p-6 lg:grid-cols-[.75fr_1fr]">
					{title && (
						<ListItem is_title list_title={<b>{title}</b>} href={`/${href}`} />
					)}
					{headings?.map((heading) => {
						const slug = slugify(heading, { lower: true, strict: true });

						return (
							<ListItem
								key={heading}
								list_title={heading}
								href={`/${href}#${slug}`}
							/>
						);
					})}
				</ul>
			</NavigationMenuContent>
		</NavigationMenuItem>
	);
}
