import { cn } from "~/lib/utils";
import type { PublishedArticle } from "~/server/db/schema";
import { DesktopHeader, MobileHeader } from "./header";
import { Footer } from "./footer";
import { getServerAuthSession } from "~/server/auth";

interface ShellProps {
  children: React.ReactNode;
  published_article?: typeof PublishedArticle.$inferSelect;
  without_footer?: boolean;
  className?: string;
}

export async function Shell({
  children,
  without_footer,
  className,
}: ShellProps) {
  const session = await getServerAuthSession();

  return (
    <div className={cn("w-full", className)}>
      <header>
        <DesktopHeader className="hidden md:flex" session={session} />
        <MobileHeader className="flex md:hidden" session={session} />
      </header>
      <main className="relative w-full">{children}</main>
      {!without_footer ? (
        <footer className="bottom-0">
          <Footer />
        </footer>
      ) : undefined}
    </div>
  );
}
