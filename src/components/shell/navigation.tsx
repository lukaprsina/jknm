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
  NavigationMenuTrigger,
  NavigationMenuContent,
} from "~/components/ui/navigation-menu";
import { DesktopHeaderLink, ListItem } from "./header";
import type { Toc } from "@stefanprobst/rehype-extract-toc";
import { smooth_scroll_store } from "../smooth-scroll";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Navigation() {
  return (
    <NavigationMenu
      className="z-50"
      /* value="zgodovina"
      onValueChange={console.log} */
    >
      <NavigationMenuList>
        <NavDropdown title="Zgodovina" href="zgodovina" toc={toc_zgodovina} />
        <NavDropdown
          title="Raziskovanje"
          href="raziskovanje"
          toc={toc_raziskovanje}
        />
        <NavDropdown
          title="Publiciranje"
          href="publiciranje"
          toc={toc_publiciranje}
        />
        <NavDropdown title="Varstvo" href="varstvo" toc={toc_varstvo} />
        <NavDropdown title="Klub" href="klub" toc={toc_klub} />
        <DesktopHeaderLink href="/arhiv">Arhiv novic</DesktopHeaderLink>
      </NavigationMenuList>
    </NavigationMenu>
  );
}

function NavDropdown({
  title,
  href,
  toc,
}: {
  title: string;
  href: string;
  toc: Toc;
}) {
  const pathname = usePathname();

  return (
    <NavigationMenuItem value={href}>
      <NavigationMenuTrigger className="bg-transparent text-base">
        <Link href={`/${href}`}>{title}</Link>
      </NavigationMenuTrigger>
      <NavigationMenuContent className="relative z-50">
        {/* <ul className="z-50 grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-1 lg:w-[600px]"> */}
        <ul className="z-50 grid w-[653px] grid-cols-1 p-4">
          {toc.at(0)?.children?.map((item) => (
            <ListItem
              key={item.id}
              title={item.value}
              href={`/${href}`} /* #${item.id} */
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
