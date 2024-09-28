import { Shell } from "~/components/shell";
import { article_variants, page_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";
import React from "react";
import { ImageGallery } from "../novica/[published_url]/image-gallery";

export default function MarkdownLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Shell show_aside>
      <div className={cn(article_variants(), page_variants())}>
        {children}
        <ImageGallery />
      </div>
    </Shell>
  );
}
