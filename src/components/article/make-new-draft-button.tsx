"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ButtonProps } from "~/components/ui/button";
import { Button } from "~/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "~/components/ui/popover";
import { get_draft_article_link } from "~/lib/article-utils";
import { unwrap_server_function } from "~/lib/orpc-action";
import { article_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";
import { createArticle } from "~/server/orpc/article/procedures";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export default function MakeNewDraftButton({
	title,
	...props
}: ButtonProps & { title?: string }) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const create_draft_mutation = useMutation({
		mutationFn: (input: Parameters<typeof createArticle>[0]) =>
			unwrap_server_function(createArticle(input)),
		onSuccess: (data) => {
			router.push(get_draft_article_link(data.id));
		},
		onSettled: () => {
			setOpen(false);
		},
	});

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<Tooltip>
				<TooltipTrigger asChild>
					<PopoverTrigger asChild>
						<Button
							{...props}
							onClick={() => {
								create_draft_mutation.mutate({ title: title ?? "Nova novica" });
							}}
						/>
					</PopoverTrigger>
				</TooltipTrigger>
				<TooltipContent>Ustvari novico</TooltipContent>
			</Tooltip>
			<PopoverContent
				className={cn(
					"relative z-[150] mx-6 w-80",
					article_variants({ variant: "card" }),
				)}
			>
				<h3>Ustvarjamo novo novico.</h3>
				<span className="flex items-center gap-2">
					<LoadingSpinner /> Prosimo, da malo počakate.
				</span>
			</PopoverContent>
		</Popover>
	);
}

function LoadingSpinner({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={cn("animate-spin", className)}
			aria-hidden="true"
		>
			<path d="M21 12a9 9 0 1 1-6.219-8.56" />
		</svg>
	);
}
