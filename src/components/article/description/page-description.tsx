"use client";

import { DotIcon } from "lucide-react";
import { format_date_for_human } from "~/lib/format-date";
import type { Session } from "next-auth";
import { Authors } from "~/components/authors";
import { CardDescription } from "~/components/ui/card";

export default function ArticlePageDescription({
  author_ids,
  old_id,
  created_at,
  session,
}: {
  author_ids: number[];
  old_id?: string;
  created_at: Date;
  session: Session | null;
}) {
  console.log("ArticlePageDescription", {
    author_ids,
    old_id,
    created_at,
    session,
  });

  return (
    <CardDescription className="flex items-center text-base text-foreground">
      <span>
        <Authors author_ids={author_ids} />
      </span>
      {author_ids.length !== 0 && <DotIcon />}
      <span> {format_date_for_human(created_at)}</span>
      {old_id && (
        <>
          <DotIcon />
          {old_id}
        </>
      )}
    </CardDescription>
  );
}
