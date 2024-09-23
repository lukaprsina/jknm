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
      <div className="flex justify-center gap-2">
        <aside id="shell-aside" className={cn("flex-shrink-0 fixed left-0 h-full w-[300px]")} />
        <main className="w-full flex-grow flex-1 ml-[300px]" id="shell-main">
          {children}
        </main>
      </div>
      {!without_footer ? (
        <footer className="bottom-0">
          <Footer />
        </footer>
      ) : undefined}
    </div>
  );
}
