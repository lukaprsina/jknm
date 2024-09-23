import { Shell } from "~/components/shell";
import { article_variants, page_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";
import React from "react";

export default function MarkdownLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Shell>
      <div className={cn(article_variants(), page_variants(), "ml-0 not_center:ml-auto")}>{children}</div>
    </Shell>
  );
}
