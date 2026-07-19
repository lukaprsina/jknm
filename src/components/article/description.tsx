"use client";

import { DotIcon } from "lucide-react";
import { format_date_for_human } from "~/lib/format-date";
import { cn } from "~/lib/utils";
import { Authors } from "../authors";
import { CardDescription } from "../ui/card";

export default function ArticleDescription({
	author_ids,
	type,
	created_at,
}: {
	author_ids: number[];
	type: "card" | "card-featured" | "page";
	created_at: Date;
}) {
	if (typeof created_at.toLocaleDateString !== "function") {
		console.warn("ArticleDescription", {
			author_ids,
			type,
			created_at,
			// eslint-disable-next-line @typescript-eslint/unbound-method
			created_at_func: created_at.toLocaleDateString,
		});
	}

	return (
		<CardDescription
			className={cn(
				"flex w-full flex-wrap items-center gap-3 text-foreground",
				type === "card" ? "justify-between" : "justify-normal gap-0",
				// author_ids.length === 0 ? "justify-end" : "justify-between",
				// type === "card" && author_ids.length !== 0 && "justify-normal gap-0",
			)}
		>
			<span className="relative line-clamp-1 flex flex-grow-0 items-center justify-start text-ellipsis text-nowrap">
				<Authors author_ids={author_ids} />
			</span>
			{type !== "card" && author_ids.length !== 0 && <DotIcon />}
			<span>{format_date_for_human(created_at)}</span>
		</CardDescription>
	);
}
