"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import type { z } from "zod";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import type { ButtonProps } from "~/components/ui/button";
import { Button } from "~/components/ui/button";
import { get_draft_article_link } from "~/lib/article-utils";
import { create_superseding_draft } from "~/server/article/lifecycle";
import type { create_superseding_draft_validator } from "~/server/article/validators";

/**
 * Spawns a new draft superseding an `archived` or `published` article and
 * navigates to it — the shared mechanism behind unarchive and "revise while
 * staying live" (#21), just triggered from different UI states.
 */
export function CreateSupersedingDraftButton({
	article_id,
	confirm,
	children,
	...props
}: ButtonProps & {
	article_id: string;
	confirm?: { title: string; description: string };
	children: ReactNode;
}) {
	const router = useRouter();

	const mutation = useMutation({
		mutationFn: (input: z.infer<typeof create_superseding_draft_validator>) =>
			create_superseding_draft(input),
		onSuccess: (draft) => {
			router.push(get_draft_article_link(draft.id));
		},
	});

	const trigger = (
		<Button
			{...props}
			onClick={confirm ? undefined : () => mutation.mutate({ article_id })}
		>
			{children}
		</Button>
	);

	if (!confirm) return trigger;

	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{confirm.title}</AlertDialogTitle>
					<AlertDialogDescription>{confirm.description}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Prekliči</AlertDialogCancel>
					<AlertDialogAction onClick={() => mutation.mutate({ article_id })}>
						Potrdi
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
