import { cn } from "~/lib/utils";
import { DesktopHeader, MobileHeader } from "./header";
import { Footer } from "./footer";
import { getServerAuthSession } from "~/server/auth";
import type { PublishedArticleWithAuthors } from "../article/card-adapter";

interface ShellProps {
  children: React.ReactNode;
  article?: PublishedArticleWithAuthors;
  without_footer?: boolean;
  without_header?: boolean;
  className?: string;
}

export async function Shell({
  article,
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
            article={article}
            className="hidden md:flex"
            session={session}
          />
          <MobileHeader
            article={article}
            className="flex md:hidden"
            session={session}
          />
        </header>
      ) : undefined}
      <main className="relative w-full" id="main">
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
