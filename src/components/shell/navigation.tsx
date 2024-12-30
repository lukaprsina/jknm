import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuLink,
} from "~/components/ui/navigation-menu";
import { DesktopHeaderLink, ListItem } from "./header";
import type { Toc } from "@stefanprobst/rehype-extract-toc";
import { usePathname } from "next/navigation";
import {
  BookIcon,
  HistoryIcon,
  ShieldIcon,
  TelescopeIcon,
  UsersIcon,
} from "lucide-react";
import { NavigationMenuTrigger } from "../navigation-menu-trigger";
import Link from "next/link";
import { smooth_scroll_store } from "~/hooks/use-smooth-scroll";
import toc from "~/toc.json";
import slugify from "slugify";

export function Navigation() {
  toc.map((item) => {
    console.log(item.file);
    item.headings.map((heading) => {
      console.log(heading.value);
    });
  });

  return (
    <NavigationMenu className="z-50">
      <NavigationMenuList>
        {toc.map((item) => {
          const section = item.file.split("\\").slice(-2, -1)[0];

          if (!section) throw new Error("TOC: No section found");

          return (
            <NavDropdown
              key={item.file}
              title={section.charAt(0).toUpperCase() + section.slice(1)}
              href={section}
              headings={item.headings
                .filter((heading) => heading.depth === 2)
                .map((heading) => heading.value)}
              icon={<HistoryIcon size={24} />}
            />
          );
        })}
      </NavigationMenuList>
    </NavigationMenu>
  );
}

/* export function Navigation() {
  return (
    <NavigationMenu
      className="z-50"
    >
      <NavigationMenuList>
        <NavDropdown
          title="Zgodovina"
          href="zgodovina"
          // toc={toc_zgodovina}
          description="Oglejte si zgodovino društva in jamarske dejavnosti v Sloveniji."
          icon={<HistoryIcon size={24} />}
        />
        <NavDropdown
          title="Raziskovanje"
          href="raziskovanje"
          // toc={toc_raziskovanje}
          description="Preberite več o raziskovanju jam in kraškega sveta."
          icon={<TelescopeIcon size={24} />}
        />
        <NavDropdown
          title="Publiciranje"
          href="publiciranje"
          // toc={toc_publiciranje}
          description="Preberite več o objavah in publikacijah društva."
          icon={<BookIcon size={24} />}
        />
        <NavDropdown
          title="Varstvo"
          href="varstvo"
          // toc={toc_varstvo}
          description="Preberite več o varstvu jam in narave."
          icon={<ShieldIcon size={24} />}
        />
        <NavDropdown
          title="Klub"
          href="klub"
          // toc={toc_klub}
          description="Oglejte si informacije o klubu, katastru jam, izobraževanju, etičnem kodeksu, društvu v javnem interesu in jamarski reševalni službi."
          icon={<UsersIcon size={24} />}
        />
        <DesktopHeaderLink href="/arhiv">Arhiv novic</DesktopHeaderLink>
      </NavigationMenuList>
    </NavigationMenu>
  );
} */

function NavDropdown({
  title,
  href,
  headings,
  description,
  icon,
}: {
  title: string;
  href: string;
  headings: string[];
  description?: string;
  icon?: React.ReactNode;
}) {
  const pathname = usePathname();

  if (!headings) {
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
          {description && (
            <li
              className="row-span-3"
              style={{
                gridRow:
                  headings &&
                  `span ${headings.length + 1} / span ${headings.length + 1}`,
              }}
            >
              <NavigationMenuLink asChild>
                <Link
                  className="flex h-full w-60 select-none flex-col justify-center rounded-md bg-gradient-to-b from-muted/50 to-muted p-6 no-underline outline-none focus:shadow-md"
                  href={`/${href}`}
                >
                  {icon}
                  <div className="mb-2 mt-4 text-lg font-medium">
                    <b>{title}</b>
                  </div>
                  <p className="text-sm leading-tight text-muted-foreground">
                    {description}
                  </p>
                </Link>
              </NavigationMenuLink>
            </li>
          )}
          {title && <ListItem list_title={<b>{title}</b>} href={`/${href}`} />}
          {headings?.map((heading) => {
            const slug = slugify(heading, { lower: true, strict: true });

            return (
              <ListItem
                key={heading}
                list_title={heading}
                href={`/${href}#${slug}`}
                onClick={(event) => {
                  if (!heading) return;

                  if (pathname === `/${href}`) {
                    event.preventDefault();
                  }

                  smooth_scroll_store.set.set_both(`/${href}`, heading);
                }}
              />
            );
          })}
        </ul>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
}
