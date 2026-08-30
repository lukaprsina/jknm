"use client";

import { ArrowUpToLineIcon } from "lucide-react";
import { useState } from "react";
import { useEditorContext } from "~/components/editor/editor-context";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "~/components/ui/tooltip";
import { useEditorMutations } from "~/hooks/use-editor-mutations";
import { KeyboardShortcut } from "./toolbar-buttons";

export function UploadDialog() {
	const [dialogOpen, setDialogOpen] = useState(false);
	const editor_context = useEditorContext();
	const editor_mutations = useEditorMutations();

	return (
		<AlertDialog open={dialogOpen} onOpenChange={(open) => setDialogOpen(open)}>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						onClick={async () => {
							const result = await editor_context.commit();
							if (!result) return;

							setDialogOpen(true);
						}}
						size="icon"
						variant="ghost"
					>
						<ArrowUpToLineIcon size={18} />
					</Button>
				</TooltipTrigger>
				<TooltipContent>
					Shrani in objavi <KeyboardShortcut>⌘</KeyboardShortcut>
					<KeyboardShortcut>⇧</KeyboardShortcut>
					<KeyboardShortcut>S</KeyboardShortcut>
				</TooltipContent>
			</Tooltip>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Shrani in objavi</AlertDialogTitle>
					<AlertDialogDescription>
						Ste prepričani, da želite objaviti novico?
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Prekliči</AlertDialogCancel>
					<AlertDialogAction
						onClick={async () => {
							await editor_mutations.publish();
							setDialogOpen(false);
						}}
					>
						OK
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
