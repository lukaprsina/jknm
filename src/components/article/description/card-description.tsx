"use client";

import { DotIcon } from "lucide-react";
import { format_date_for_human } from "~/lib/format-date";
import { cn } from "~/lib/utils";
import { Authors } from "../../authors";
import { CardDescription } from "../../ui/card";

export default function ArticleCardDescription({
  author_ids,
  featured,
  created_at,
}: {
  author_ids: number[];
  featured?: boolean;
  created_at: Date;
}) {
  return (
    <CardDescription
      className={cn(
        "flex w-full items-center gap-3 text-foreground",
        author_ids.length === 0 ? "justify-end" : "justify-between",
        featured && author_ids.length !== 0 && "justify-normal gap-0",
      )}
    >
      <span className="relative line-clamp-1 flex flex-grow-0 flex-nowrap items-center justify-start text-ellipsis text-nowrap">
        <Authors author_ids={author_ids} />
      </span>
      {featured && author_ids.length !== 0 && <DotIcon size={20} />}
      <span className="flex flex-nowrap text-nowrap">
        {format_date_for_human(created_at)}
      </span>
    </CardDescription>
  );
}
