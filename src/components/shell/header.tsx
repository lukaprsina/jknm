import React from "react";
import Link from "next/link";

import { cn } from "~/lib/utils";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "~/components/ui/navigation-menu";
import { buttonVariants } from "../ui/button";

export function LinksMenu() {
  return (
    <NavigationMenu className="z-50">
      <NavigationMenuList>
        <DesktopHeaderLink href="/zgodovina">Zgodovina</DesktopHeaderLink>
        <DesktopHeaderLink href="/raziskovanje">Raziskovanje</DesktopHeaderLink>
        <DesktopHeaderLink href="/publiciranje">Publiciranje</DesktopHeaderLink>
        <DesktopHeaderLink href="/varstvo">Varstvo</DesktopHeaderLink>
        <NavigationMenuItem>
          <NavigationMenuTrigger className="bg-transparent text-base">
            Klub
          </NavigationMenuTrigger>
          <NavigationMenuContent className="relative z-50">
            <ul className="z-50 grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
              <ListItem list_title="Kataster jam" href=""></ListItem>
              <ListItem list_title="Izobraževanje" href=""></ListItem>
              <ListItem list_title="Etični kodeks" href=""></ListItem>
              <ListItem
                list_title="Društvo v javnem interesu"
                href=""
              ></ListItem>
              <ListItem
                list_title="Jamarska reševalna služba"
                href=""
              ></ListItem>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <DesktopHeaderLink href="/arhiv">Arhiv novic</DesktopHeaderLink>
      </NavigationMenuList>
    </NavigationMenu>
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
      <Link href={href} legacyBehavior passHref>
        <NavigationMenuLink
          className={cn(
            navigationMenuTriggerStyle(),
            "bg-transparent text-base dark:bg-primary/80 dark:text-primary-foreground",
          )}
        >
          {children}
        </NavigationMenuLink>
      </Link>
    </NavigationMenuItem>
  );
}

export const ListItem = React.forwardRef<
  React.ComponentRef<"a">,
  React.ComponentPropsWithoutRef<"a"> & { list_title?: React.ReactNode }
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
          /* className={cn(
            "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
            className,
          )} */
          className={cn(
            "prose",
            buttonVariants({ size: "sm", variant: "link" }),
            className,
          )}
          {...props}
        >
          {list_title}
          {/* text-sm font-medium */}
          {/* <div className="text-sm font-medium leading-none">{title}</div> */}
          {/* <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
            {children}
          </p> */}
        </Link>
      </NavigationMenuLink>
    </li>
  );
});
ListItem.displayName = "ListItem";
