"use client";

import { useMutation } from "@tanstack/react-query";
import { PencilIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import type { z } from "zod";
import type { ButtonProps } from "~/components/ui/button";
import { Button } from "~/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "~/components/ui/tooltip";
import { get_draft_article_link } from "~/lib/article-utils";
import { create_superseding_draft } from "~/server/article/lifecycle";
import type { create_superseding_draft_validator } from "~/server/article/validators";
import type { Session } from "~/server/auth";
import MakeNewDraftButton from "../article/make-new-draft-button";
import type { EditableArticleRef } from "../article/new-adapter";
import { SettingsDropdown } from "../settings";

export default function EditingButtons({
	published_article,
	session,
}: {
	published_article?: EditableArticleRef;
	session: Session | null;
}) {
	if (!session) return null;

	return (
		<>
			{published_article && (
				<EditButton variant="ghost" article_id={published_article.id} />
			)}
			<MakeNewDraftButton
				className="dark:bg-primary/80 dark:text-primary-foreground"
				variant="ghost"
				size="icon"
			>
				<PlusIcon size={24} />
			</MakeNewDraftButton>
			<SettingsDropdown />
		</>
	);
}

/**
 * Pencil for a published `Article` — spawns a superseding draft (#21's
 * "revise while live") rather than editing the live row directly.
 */
export function EditButton({
	new_tab,
	article_id,
	...props
}: ButtonProps & {
	new_tab?: boolean;
	article_id: string;
}) {
	const router = useRouter();

	const mutation = useMutation({
		mutationFn: (input: z.infer<typeof create_superseding_draft_validator>) =>
			create_superseding_draft(input),
		onSuccess: (draft) => {
			const new_url = get_draft_article_link(draft.id);
			if (new_tab) {
				window.open(new_url, "_blank");
			} else {
				router.push(new_url);
			}
		},
	});

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					className="flex flex-shrink-0 dark:bg-primary/80 dark:text-primary-foreground"
					size="icon"
					onClick={() => mutation.mutate({ article_id })}
					{...props}
				>
					<PencilIcon size={20} />
				</Button>
			</TooltipTrigger>
			<TooltipContent>Uredi</TooltipContent>
		</Tooltip>
	);
}
