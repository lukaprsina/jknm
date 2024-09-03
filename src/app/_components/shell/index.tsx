import { cn } from "~/lib/utils";
import type { PublishedArticle } from "~/server/db/schema";

interface ShellProps {
  children: React.ReactNode;
  published_article?: typeof PublishedArticle.$inferSelect;
  without_footer?: boolean;
  className?: string;
}

export function Shell({ children, without_footer, className }: ShellProps) {
  return (
    <div className={cn("w-full", className)}>
      <header>
        <Header />
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
