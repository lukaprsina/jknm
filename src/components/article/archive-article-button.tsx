"use client";

import { useMutation } from "@tanstack/react-query";
import { ArchiveIcon } from "lucide-react";
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
import { archive_article } from "~/server/article/lifecycle";
import type { archive_article_validator } from "~/server/article/validators";

/**
 * `draft`/`published` -> `archived` (#21): single mechanism for both "hide a
 * mistake" and "archive stale content".
 */
export function ArchiveArticleButton({
	article_id,
	on_archived,
	children,
	...props
}: ButtonProps & {
	article_id: string;
	on_archived?: () => void;
	children?: ReactNode;
}) {
	const toaster = useToast();

	const mutation = useMutation({
		mutationFn: (input: z.infer<typeof archive_article_validator>) =>
			archive_article(input),
		onSuccess: () => on_archived?.(),
		onError: (error) => {
			toaster.toast({
				title: "Napaka pri arhiviranju novičke",
				description: error.message,
			});
		},
	});

	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button {...props}>{children ?? <ArchiveIcon size={18} />}</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Arhiviraj novičko</AlertDialogTitle>
					<AlertDialogDescription>
						Ste prepričani, da želite arhivirati to novičko? Javna stran ne bo
						več dosegljiva, novičko pa lahko kadarkoli obnovite iz arhiva.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Prekliči</AlertDialogCancel>
					<AlertDialogAction onClick={() => mutation.mutate({ article_id })}>
						Arhiviraj
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
