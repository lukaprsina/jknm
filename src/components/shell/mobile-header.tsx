"use client";

import React, { Fragment, useEffect, useMemo, useRef } from "react";
import Link from "next/link";

import { Logo } from "./logo";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "~/components/ui/sheet";
import { MenuIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import EditingButtons from "./editing-buttons";
import type { Session } from "next-auth";
import type {
  DraftArticleWithAuthors,
  PublishedArticleWithAuthors,
} from "../article/adapter";
import { createStore } from "zustand-x";
import { useBreakpoint } from "~/hooks/use-breakpoint";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { usePathname } from "next/navigation";
import { cn } from "~/lib/utils";
import { shell_store } from "./desktop-header";

export const mobile_nav_store = createStore("mobile-nav")<{ open: boolean }>({
  open: false,
});

export function MobileHeader({
  published_article,
  draft_article,
  session,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  published_article?: PublishedArticleWithAuthors;
  draft_article?: DraftArticleWithAuthors;
  session: Session | null;
}) {
  const sticky_navbar_ref = useRef<HTMLDivElement | null>(null);
  const md_breakpoint = useBreakpoint("md");

  useEffect(() => {
    // console.log("mobile md_breakpoint", md_breakpoint);
    if (md_breakpoint) {
      mobile_nav_store.set.open(false);
      return;
    }

    if (!sticky_navbar_ref.current) return;

    /* console.log(
      "mobile setting navbar height",
      sticky_navbar_ref.current.clientHeight,
      { md_breakpoint },
    ); */

    shell_store.set.navbar_height(sticky_navbar_ref.current.clientHeight);
  }, [md_breakpoint]);

  return (
    <div
      ref={sticky_navbar_ref}
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
      <MobileSheet
        published_article={published_article}
        draft_article={draft_article}
        session={session}
      />
    </div>
  );
}

const MOBILE_NAV_LINKS = [
  { title: "Zgodovina", href: "zgodovina" },
  { title: "Raziskovanje", href: "raziskovanje" },
  { title: "Publiciranje", href: "publiciranje" },
  { title: "Varstvo", href: "varstvo" },
  { title: "Klub", href: "klub" },
  { title: "Arhiv novic", href: "arhiv" },
];

export function MobileSheet({
  published_article,
  draft_article,
  session,
}: {
  published_article?: PublishedArticleWithAuthors;
  draft_article?: DraftArticleWithAuthors;
  session: Session | null;
}) {
  const open = mobile_nav_store.use.open();
  const pathname = usePathname();

  const links: { title: string; href: string; active?: boolean }[] =
    useMemo(() => {
      return MOBILE_NAV_LINKS.map((link) => {
        if (pathname.includes(link.href)) {
          return { ...link, active: true };
        }

        return link;
      });
    }, [pathname]);

  return (
    <Sheet
      open={open}
      modal={false}
      onOpenChange={(new_state) => {
        console.log("setting mobile nav open", new_state);
        mobile_nav_store.set.open(new_state);
      }}
    >
      <SheetTrigger asChild>
        <Button variant="outline" size="icon">
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <SheetHeader>
          <div className="flex w-full items-center justify-center">
            <SheetClose asChild>
              <Link href="/">
                <Logo className="w-32" />
              </Link>
            </SheetClose>
          </div>
          <div className="flex justify-end">
            <EditingButtons
              published_article={published_article}
              draft_article={draft_article}
              session={session}
            />
          </div>
          <SheetTitle>Jamarski klub Novo mesto</SheetTitle>
          <VisuallyHidden>
            <SheetDescription>mobile navigation bar</SheetDescription>
          </VisuallyHidden>
        </SheetHeader>
        <ScrollArea className="my-4 h-[calc(100vh-8rem)] pb-24 pl-6">
          {links.map((link) => (
            <Fragment key={link.href}>
              <Link
                className="block"
                href={`/${link.href}`}
                onClick={() => {
                  mobile_nav_store.set.open(false);
                }}
              >
                {link.title}
              </Link>
              {link.active && <div id="mobile-toc" />}
            </Fragment>
          ))}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
