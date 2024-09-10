"use client";

import React, { useEffect, useRef, useState } from "react";
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
} from "../article/card-adapter";
import { FacebookIcon, LinksMenu, YoutubeIcon } from "./header";

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
            <EditingButtons
              published_article={published_article}
              draft_article={draft_article}
              session={session}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <FacebookIcon />
            <YoutubeIcon />
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
