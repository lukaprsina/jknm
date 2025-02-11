import { Shell } from "~/components/shell";
import { article_variants, page_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";
import React from "react";
import { ImageGallery } from "../novica/[published_url]/image-gallery";
import { ScrollProvider } from "~/contexts/scroll-context";
import ScrollToTop from "~/components/shell/scroll-to-top";

export default function MarkdownLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Shell>
      <ScrollProvider>
        <div className={cn(article_variants(), page_variants())}>
          {children}
          <ImageGallery />
        </div>
        <ScrollToTop />
      </ScrollProvider>
    </Shell>
  );
}
