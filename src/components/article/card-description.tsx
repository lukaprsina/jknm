import { DotIcon } from "lucide-react";
import { format_date } from "~/lib/format-date";
import { cn } from "~/lib/utils";
import { Authors } from "../authors";
import { CardDescription } from "../ui/card";

export function ArticleCardDescription({
  author_ids,
  featured,
  created_at,
}: {
  author_ids: number[];
  featured?: boolean;
  created_at: Date;
}) {
  return <p></p>;
}
