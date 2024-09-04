import { cn } from "~/lib/utils";
import type { PublishedArticle } from "~/server/db/schema";
import { DesktopHeader, MobileHeader } from "./header";
import { Footer } from "./footer";
import { getServerAuthSession } from "~/server/auth";

interface ShellProps {
  children: React.ReactNode;
  published_article?: typeof PublishedArticle.$inferSelect;
  without_footer?: boolean;
  without_header?: boolean;
  className?: string;
}

export async function Shell({
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
          <DesktopHeader className="hidden md:flex" session={session} />
          <MobileHeader className="flex md:hidden" session={session} />
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
