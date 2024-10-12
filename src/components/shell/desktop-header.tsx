"use client";

import React, { useCallback, useEffect, useRef } from "react";
import Link from "next/link";

import { NoviceAutocomplete } from "./autocomplete";
import EditingButtons from "./editing-buttons";
import { Logo } from "./logo";
import { cn } from "~/lib/utils";
import { Separator } from "~/components/ui/separator";
import type { Session } from "next-auth";
import type {
  DraftArticleWithAuthors,
  PublishedArticleWithAuthors,
} from "../article/adapter";
import { createStore } from "zustand-x";
import { FacebookIcon, YoutubeIcon } from "./icons";
import { Navigation } from "./navigation";
import { useBreakpoint } from "~/hooks/use-breakpoint";

export interface ShellStore {
  is_header_sticky: boolean;
  navbar_height: number | undefined;
}

export const shell_store = createStore("shell-store")<ShellStore>({
  is_header_sticky: false,
  navbar_height: undefined,
});

export function DesktopHeader({
  published_article,
  draft_article,
  className,
  session,
  ...props
}: React.ComponentProps<"div"> & {
  published_article?: PublishedArticleWithAuthors;
  draft_article?: DraftArticleWithAuthors;
  session: Session | null;
}) {
  const sticky_navbar_ref = useRef<HTMLDivElement | null>(null);
  const header_ref = useRef<HTMLDivElement | null>(null);
  const is_header_sticky = shell_store.use.is_header_sticky();
  const navbar_height = shell_store.use.navbar_height();
  const md_breakpoint = useBreakpoint("md");

  const handle_scroll = useCallback(() => {
    if (!header_ref.current) return;

    // console.log("handle scroll", window.scrollY);

    // TODO: + 2 is a hack for the separator
    const should_be_sticky =
      window.scrollY > header_ref.current.clientHeight + 2;

    // console.log("handle scroll", window.scrollY);

    /* console.log("handle scroll", {
      clientHeight: sticky_navbar.current.clientHeight,
      clientHeight2: header_ref.current.clientHeight,
      new_sticky: should_be_sticky,
      old_sticky: shell_store.get.is_header_sticky(),
    }); */

    if (should_be_sticky !== shell_store.get.is_header_sticky()) {
      // console.log("setting sticky", { should_be_sticky, md_breakpoint });
      shell_store.set.is_header_sticky(should_be_sticky);
    }
  }, []);

  useEffect(() => {
    if (!sticky_navbar_ref.current) return;

    if (md_breakpoint) {
      /* console.log(
        "desktop setting navbar height",
        sticky_navbar_ref.current.clientHeight,
        { md_breakpoint },
      ); */

      shell_store.set.navbar_height(sticky_navbar_ref.current.clientHeight);
    }
  }, [md_breakpoint]);

  useEffect(() => {
    window.addEventListener("scroll", handle_scroll);

    return () => {
      window.removeEventListener("scroll", handle_scroll);
    };
  }, [handle_scroll]);

  // activate on mount
  useEffect(() => {
    handle_scroll();
  }, [handle_scroll]);

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
            <EditingButtons
              published_article={published_article}
              draft_article={draft_article}
              session={session}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <NoviceAutocomplete detached="" />
            <FacebookIcon />
            <YoutubeIcon />
          </div>
        </div>
      </div>
      <Separator
        style={{
          marginBottom: is_header_sticky ? navbar_height : "",
        }}
      />
      <div
        ref={sticky_navbar_ref}
        className={cn(
          "relative z-40 flex w-full items-center justify-center px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-12",
          is_header_sticky ? "fixed top-0 bg-white/80 transition-colors" : null,
          className,
        )}
      >
        {/* <LinksMenu /> */}
        <Navigation />
      </div>
    </>
  );
}
