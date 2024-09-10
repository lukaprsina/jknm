"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { NoviceAutocomplete } from "./autocomplete";
import EditingButtons from "./editing-buttons";
import { Logo } from "./logo";
import { MobileSheet } from "./mobile-sheet";
import { cn } from "~/lib/utils";
import { Separator } from "~/components/ui/separator";
import type { Session } from "next-auth";
import { buttonVariants } from "~/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "~/components/ui/navigation-menu";
import type { PublishedArticleWithAuthors } from "../article/card-adapter";

export function DesktopHeader({
  article,
  className,
  session,
  ...props
}: React.ComponentProps<"div"> & {
  article?: PublishedArticleWithAuthors;
  session: Session | null;
}) {
  const [sticky, setSticky] = useState(false);
  const sticky_navbar = useRef<HTMLDivElement | null>(null);
  const header_ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!sticky_navbar.current || !header_ref.current) return;

      // TODO: + 2 is a hack for the separator
      const new_sticky = window.scrollY > header_ref.current.clientHeight + 2;

      if (new_sticky !== sticky) {
        setSticky(new_sticky);
      }
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [sticky]);

  return (
    <>
      <div
        ref={header_ref}
        className={cn(
          "container relative flex h-[182px] w-full items-end justify-between px-6 py-4 backdrop-blur-sm",
          className,
        )}
        {...props}
      >
        <Link href="/" className="flex-shrink-0 gap-6 text-2xl font-bold">
          <div className="block lg:hidden">
            <p>Jamarski klub</p>
            <p>Novo mesto</p>
          </div>
          <div className="hidden lg:block">
            <p>Jamarski klub Novo mesto</p>
          </div>
        </Link>
        <Link href="/" className="absolute left-1/2 -translate-x-1/2 transform">
          <Logo className="w-[150px]" />
        </Link>
        <div className="flex h-full flex-shrink-0 flex-col justify-between">
          <div className="flex justify-end">
            <EditingButtons article={article} session={session} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <FacebookIcon />
            <YoutubeIcon />
            {/* <ThemeToggle className="dark:bg-primary/80 dark:text-primary-foreground" /> */}
            <NoviceAutocomplete detached="" />
          </div>
        </div>
      </div>
      <Separator
        style={{
          marginBottom: sticky ? sticky_navbar.current?.clientHeight : "",
        }}
      />
      <div
        ref={sticky_navbar}
        className={cn(
          "relative z-40 flex w-full items-center justify-center px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-12",
          sticky ? "fixed top-0 bg-white/80 transition-colors" : null,
          className,
        )}
      >
        <LinksMenu />
      </div>
    </>
  );
}

export function MobileHeader({
  article,
  session,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  article?: PublishedArticleWithAuthors;
  session: Session | null;
}) {
  return (
    <div
      className={cn(
        "fixed top-0 z-40 flex w-full items-center justify-between bg-white/90 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        className,
      )}
      {...props}
    >
      {/* <Logo className="w-4" /> */}
      <Link className="text-2xl font-bold" href="/">
        Jamarski klub Novo mesto
      </Link>
      <MobileSheet article={article} session={session} />
    </div>
  );
}

// simpleicons.org
function FacebookIcon() {
  return (
    <Link
      href="https://www.facebook.com/jknovomesto"
      target="_blank"
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon" }),
        "h-9 w-9 p-0 text-center",
      )}
    >
      <svg
        role="img"
        viewBox="0 0 24 24"
        className="h-6 w-6"
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>Facebook</title>
        <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
      </svg>
    </Link>
  );
}

// simpleicons.org
function YoutubeIcon() {
  return (
    <Link
      href="https://www.youtube.com/@MrKlemi"
      target="_blank"
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon" }),
        "h-9 w-9 p-0 text-center",
      )}
    >
      <svg
        role="img"
        viewBox="0 0 24 24"
        className="h-6 w-6"
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>YouTube</title>
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    </Link>
  );
}

export function LinksMenu() {
  return (
    <NavigationMenu className="z-50">
      <NavigationMenuList>
        <DesktopHeaderLink href="/novice">Novice</DesktopHeaderLink>
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
              <ListItem title="Kataster jam" href=""></ListItem>
              <ListItem title="Izobraževanje" href=""></ListItem>
              <ListItem title="Etični kodeks" href=""></ListItem>
              <ListItem title="Društvo v javnem interesu" href=""></ListItem>
              <ListItem title="Jamarska reševalna služba" href=""></ListItem>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}

function DesktopHeaderLink({
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

const ListItem = React.forwardRef<
  React.ComponentRef<"a">,
  React.ComponentPropsWithoutRef<"a">
>(({ className, title, children, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <a
          ref={ref}
          className={cn(
            "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
            className,
          )}
          {...props}
        >
          {/* text-sm font-medium */}
          <div className="text-sm font-medium leading-none">{title}</div>
          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
            {children}
          </p>
        </a>
      </NavigationMenuLink>
    </li>
  );
});
ListItem.displayName = "ListItem";
