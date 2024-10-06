// @ ts-expect-error - mdx import
import { tableOfContents as toc_zgodovina } from "~/app/(static)/zgodovina/page.mdx";
// @ ts-expect-error - mdx import
import { tableOfContents as toc_raziskovanje } from "~/app/(static)/raziskovanje/page.mdx";
// @ ts-expect-error - mdx import
import { tableOfContents as toc_publiciranje } from "~/app/(static)/publiciranje/page.mdx";
// @ ts-expect-error - mdx import
import { tableOfContents as toc_varstvo } from "~/app/(static)/varstvo/page.mdx";
// @ ts-expect-error - mdx import
import { tableOfContents as toc_klub } from "~/app/(static)/klub/page.mdx";
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

export function Navigation() {
  return (
    <NavigationMenu
      className="z-50"
      /* value="zgodovina"
      onValueChange={console.log} */
    >
      <NavigationMenuList>
        <NavDropdown
          title="Zgodovina"
          href="zgodovina"
          toc={toc_zgodovina}
          description="Oglejte si zgodovino društva in jamarske dejavnosti v Sloveniji."
          icon={<HistoryIcon size={24} />}
        />
        <NavDropdown
          title="Raziskovanje"
          href="raziskovanje"
          toc={toc_raziskovanje}
          description="Preberite več o raziskovanju jam in kraškega sveta."
          icon={<TelescopeIcon size={24} />}
        />
        <NavDropdown
          title="Publiciranje"
          href="publiciranje"
          toc={toc_publiciranje}
          description="Preberite več o objavah in publikacijah društva."
          icon={<BookIcon size={24} />}
        />
        <NavDropdown
          title="Varstvo"
          href="varstvo"
          toc={toc_varstvo}
          description="Preberite več o varstvu jam in narave."
          icon={<ShieldIcon size={24} />}
        />
        <NavDropdown
          title="Klub"
          href="klub"
          toc={toc_klub}
          description="Oglejte si informacije o klubu, katastru jam, izobraževanju, etičnem kodeksu, društvu v javnem interesu in jamarski reševalni službi."
          icon={<UsersIcon size={24} />}
        />
        <DesktopHeaderLink href="/arhiv">Arhiv novic</DesktopHeaderLink>
      </NavigationMenuList>
    </NavigationMenu>
  );
}

function NavDropdown({
  title,
  href,
  toc,
  description,
  icon,
}: {
  title: string;
  href: string;
  toc: Toc;
  description?: string;
  icon?: React.ReactNode;
}) {
  const pathname = usePathname();

  const c = toc.at(0)?.children;

  return (
    <NavigationMenuItem value={href}>
      <NavigationMenuTrigger className="bg-transparent text-base">
        {/* <Link href={`/${href}`}>{title}</Link> */}
        {title}
      </NavigationMenuTrigger>
      {/* relative */}
      <NavigationMenuContent className="z-50">
        {/* <ul className="z-50 grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-1 lg:w-[600px]"> */}
        {/* <ul className="z-50 grid w-[653px] grid-cols-1 p-4"> */}
        {/* <ul className="grid gap-3 p-6 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]"> */}
        <ul className="grid w-[653px] p-6 lg:grid-cols-[.75fr_1fr]">
          {description && (
            <li
              className="row-span-3"
              style={{
                gridRow: c && `span ${c.length + 1} / span ${c.length + 1}`,
              }}
            >
              <NavigationMenuLink asChild>
                <Link
                  /* justify-end w-full h-full  */
                  className="flex h-full w-60 select-none flex-col justify-center rounded-md bg-gradient-to-b from-muted/50 to-muted p-6 no-underline outline-none focus:shadow-md"
                  href={`/${href}`}
                >
                  {/* <HistoryIcon size={24} className="h-6 w-6" /> */}
                  {icon}
                  <div className="mb-2 mt-4 text-lg font-medium">
                    <b>{toc.at(0)?.value}</b>
                  </div>
                  <p className="text-sm leading-tight text-muted-foreground">
                    {description}
                  </p>
                </Link>
              </NavigationMenuLink>
            </li>
          )}
          {toc.at(0)?.value && (
            <ListItem
              list_title={<b>{toc.at(0)?.value}</b>}
              href={`/${href}`}
            />
          )}
          {toc.at(0)?.children?.map((item) => (
            <ListItem
              key={item.id}
              list_title={item.value}
              // href={`/${href}`}
              href={`/${href}#${item.id}`}
              onClick={(event) => {
                if (!item.id) return;

                if (pathname === `/${href}`) {
                  event.preventDefault();
                }

                smooth_scroll_store.set.set_both(`/${href}`, item.id);
              }}
            />
          ))}
        </ul>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
}
