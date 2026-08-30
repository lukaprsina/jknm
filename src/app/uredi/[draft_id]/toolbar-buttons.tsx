"use client";

import { FileXIcon, SaveIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useContext, useEffect } from "react";
import { ArchiveArticleButton } from "~/components/article/archive-article-button";
import {
	DraftArticleContext,
	useIsSupersedingDraft,
} from "~/components/article/context";
import { DeleteArticleButton } from "~/components/article/delete-article-button";
import { Button } from "~/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "~/components/ui/tooltip";
import { useEditorMutations } from "~/hooks/use-editor-mutations";
import { SUPERSEDING_DRAFT_DIALOGS } from "~/server/article/lifecycle-rules";
import { SettingsDialog } from "./settings-dialog";
import { UploadDialog } from "./upload-dialog";

export function ToolbarButtons() {
	return (
		<div className="flex flex-wrap items-center">
			<SaveButton />
			<UploadDialog />
			<SettingsDialog />
			<ClearButton />
		</div>
	);
}

export function SaveButton() {
	const editor_mutations = useEditorMutations();

	const handleKeyPress = useCallback(
		(event: KeyboardEvent) => {
			if (event.key.toLowerCase() === "s" && event.ctrlKey && event.shiftKey) {
				event.preventDefault();
				void editor_mutations.publish();
			} else if (event.key.toLowerCase() === "s" && event.ctrlKey) {
				event.preventDefault();
				void editor_mutations.save_draft();
			}
		},
		[editor_mutations],
	);

	useEffect(() => {
		document.addEventListener("keydown", handleKeyPress);

		return () => {
			document.removeEventListener("keydown", handleKeyPress);
		};
	});

	return (
		<div className="not-prose flex gap-1 text-sm">
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						onClick={() => editor_mutations.save_draft()}
					>
						<SaveIcon size={18} />
					</Button>
				</TooltipTrigger>
				<TooltipContent>
					Shrani kot osnutek <KeyboardShortcut>⌘</KeyboardShortcut>
					<KeyboardShortcut>S</KeyboardShortcut>
				</TooltipContent>
			</Tooltip>
		</div>
	);
}

export function KeyboardShortcut({ children }: { children: React.ReactNode }) {
	return (
		<kbd className="pointer-events-none ml-2 inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
			<span className="text-xs">{children}</span>
		</kbd>
	);
}

export function ClearButton() {
	const draft_article = useContext(DraftArticleContext);
	const editor_mutations = useEditorMutations();
	const is_superseding = useIsSupersedingDraft();
	const router = useRouter();

	if (!draft_article) return null;

	const article_id = draft_article.id;
	const archive_label = is_superseding
		? "Arhiviraj objavljeno novičko"
		: "Arhiviraj novičko";
	const delete_label = is_superseding
		? "Izbriši objavljeno novičko"
		: "Izbriši novičko";

	return (
		<>
			<ArchiveArticleButton
				article_id={article_id}
				variant="ghost"
				size="icon"
				aria-label={archive_label}
				title={archive_label}
				dialog={is_superseding ? SUPERSEDING_DRAFT_DIALOGS.archive : undefined}
				on_archived={() => router.push("/")}
			/>
			{is_superseding && (
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							aria-label="Zavrzi osnutek"
							title="Zavrzi osnutek"
							onClick={() => editor_mutations.discard_draft()}
						>
							<FileXIcon size={18} />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Zavrzi osnutek</TooltipContent>
				</Tooltip>
			)}
			<DeleteArticleButton
				article_id={article_id}
				variant="ghost"
				size="icon"
				aria-label={delete_label}
				title={delete_label}
				dialog={is_superseding ? SUPERSEDING_DRAFT_DIALOGS.delete : undefined}
				on_deleted={() => router.push("/")}
			/>
		</>
	);
}
