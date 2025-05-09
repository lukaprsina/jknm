import { cn } from "~/lib/utils";
import { DesktopHeader } from "./desktop-header";
import { Footer } from "./footer";
import { getServerAuthSession } from "~/server/auth";
import type {
  DraftArticleWithAuthors,
  PublishedArticleWithAuthors,
} from "../article/adapter";
import React from "react";
import { Separator } from "../ui/separator";
import { MobileHeader } from "./mobile-header";
import { SearchProvider } from "./search-context";
import { Searchbar } from "./searchbar";
// import { PinkBackground } from "./background"; // Added import

interface ShellProps {
  children: React.ReactNode;
  published_article?: PublishedArticleWithAuthors;
  draft_article?: DraftArticleWithAuthors;
  without_footer?: boolean;
  without_header?: boolean;
  show_aside?: boolean;
  className?: string;
}

export async function Shell({
  published_article,
  draft_article,
  children,
  without_footer,
  without_header,
  show_aside,
  className,
}: ShellProps) {
  const session = await getServerAuthSession();

  return (
    <SearchProvider>
      <div className={cn("w-full", className)}>
        {!without_header ? (
          /* bg-gradient-to-b from-[#BBB] to-gray-50  */
          <header className="h-20 w-full text-gray-800 md:h-auto">
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
        <div /* className={"flex justify-start gap-2 not_center:justify-center"} */
        >
          <aside
            id="shell-aside"
            className={cn(
              // "fixed left-0 h-full w-[300px] flex-shrink-0",
              "fixed flex h-full w-full items-center justify-center",
              // ? "md:block" :
              !show_aside && "hidden",
            )}
          />
          <main
            className={cn(
              "w-full",
              show_aside &&
                "md:ml-[300px] md:flex-1 md:flex-grow not_center:ml-0",
            )}
            id="shell-main"
          >
            {children}
          </main>
        </div>
        {without_footer ? undefined : (
          <>
            <Separator />
            <Footer />
          </>
        )}
      </div>
      <Searchbar />
    </SearchProvider>
  );
}
