// @ts-expect-error - mdx import
import { tableOfContents as toc_zgodovina } from "~/app/(static)/zgodovina/page.mdx";
// @ts-expect-error - mdx import
import { tableOfContents as toc_raziskovanje } from "~/app/(static)/raziskovanje/page.mdx";
// @ts-expect-error - mdx import
import { tableOfContents as toc_publiciranje } from "~/app/(static)/publiciranje/page.mdx";
// @ts-expect-error - mdx import
import { tableOfContents as toc_varstvo } from "~/app/(static)/varstvo/page.mdx";
// @ts-expect-error - mdx import
import { tableOfContents as toc_klub } from "~/app/(static)/klub/page.mdx";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
} from "@radix-ui/react-navigation-menu";
import { DesktopHeaderLink, ListItem } from "./header";
import type { Toc } from "@stefanprobst/rehype-extract-toc";

export function Navigation() {
  return (
    <NavigationMenu className="z-50">
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger className="bg-transparent text-base">
            Klub
          </NavigationMenuTrigger>
          <NavigationMenuContent className="relative z-50">
            <ul className="z-50 grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
              {(toc_klub as unknown as Toc).at(0)?.children?.map((item) => (
                // <ListItem key={item.id} title={item.value} />
                <p key={item.id}>{item.value}</p>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}
