import { cn } from "~/lib/utils";
import { DesktopHeader } from "./desktop-header";
import { Footer } from "./footer";
import { getServerAuthSession } from "~/server/auth";
import type {
  DraftArticleWithAuthors,
  PublishedArticleWithAuthors,
} from "../article/card-adapter";
import { MobileHeader } from "./header";
import React from "react";

interface ShellProps {
  children: React.ReactNode;
  published_article?: PublishedArticleWithAuthors;
  draft_article?: DraftArticleWithAuthors;
  without_footer?: boolean;
  without_header?: boolean;
  className?: string;
}

export async function Shell({
  published_article,
  draft_article,
  children,
  without_footer,
  without_header,
  className,
}: ShellProps) {
  const session = await getServerAuthSession();

  return (
    <div className={cn("w-full", className)}>
      {!without_header ? (
        <header className="h-28 w-full md:h-auto">
          <DesktopHeader
            published_article={published_article}
            draft_article={draft_article}
            className="hidden md:flex"
            session={session}
          />
          <MobileHeader
            published_article={published_article}
            draft_article={draft_article}
            className="flex md:hidden"
            session={session}
          />
        </header>
      ) : undefined}
      <aside id="shell-aside"  className="fixed top-0 right-0 z-[501] bg-white" />
      <main className="relative w-full" id="shell-main">
        {children}
      </main>
      {!without_footer ? (
        <footer className="bottom-0">
          <Footer />
        </footer>
      ) : undefined}
    </div>
  );
}
