"use client";

import { DotIcon } from "lucide-react";
import { format_date_for_human } from "~/lib/format-date";
import { cn } from "~/lib/utils";
import { Authors } from "../authors";
import { CardDescription } from "../ui/card";
import { useBreakpoint } from "~/hooks/use-breakpoint";

export default function ArticleCardDescription({
  author_ids,
  featured,
  created_at,
  old_id,
}: {
  author_ids: number[];
  featured?: boolean;
  created_at: Date;
  old_id?: string;
}) {
  const md_breakpoint = useBreakpoint("md");

  return (
    <CardDescription
      className={cn(
        "flex w-full flex-wrap items-center gap-3 text-foreground",
        author_ids.length === 0 ? "justify-end" : "justify-between",
        featured &&
          md_breakpoint &&
          author_ids.length !== 0 &&
          "justify-normal gap-0",
      )}
    >
      <span className="relative line-clamp-1 flex flex-grow-0 items-center justify-start text-ellipsis text-nowrap">
        <Authors author_ids={author_ids} />
      </span>
      {featured && md_breakpoint && author_ids.length !== 0 && <DotIcon />}
      <span>{format_date_for_human(created_at)}</span>
      {old_id && (
        <>
          <DotIcon />
          <span>#{old_id}</span>
        </>
      )}
    </CardDescription>
  );
}
