"use client";

import { useMutation } from "@tanstack/react-query";
import { TrashIcon } from "lucide-react";
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
import { useToast } from "~/hooks/use-toast";
import { delete_article } from "~/server/article/lifecycle";
import type { delete_article_validator } from "~/server/article/validators";

/**
 * `draft`/`published`/`archived` -> `deleted`: direct, one plain confirm
 * dialog (#21). Terminal — no restore action.
 */
export function DeleteArticleButton({
	article_id,
	on_deleted,
	children,
	dialog,
	...props
}: ButtonProps & {
	article_id: string;
	on_deleted?: () => void;
	children?: ReactNode;
	/** Overrides the confirm dialog copy — e.g. for deleting from a superseding draft. */
	dialog?: { title: string; description: string };
}) {
	const toaster = useToast();

	const mutation = useMutation({
		mutationFn: (input: z.infer<typeof delete_article_validator>) =>
			delete_article(input),
		onSuccess: () => on_deleted?.(),
		onError: (error) => {
			toaster.toast({
				title: "Napaka pri brisanju novičke",
				description: error.message,
			});
		},
	});

	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button {...props}>{children ?? <TrashIcon size={18} />}</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						{dialog?.title ?? "Izbriši novičko"}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{dialog?.description ??
							"Ste prepričani, da želite izbrisati to novičko? Izbrisanih novičk ni mogoče obnoviti."}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Prekliči</AlertDialogCancel>
					<AlertDialogAction onClick={() => mutation.mutate({ article_id })}>
						Izbriši
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
