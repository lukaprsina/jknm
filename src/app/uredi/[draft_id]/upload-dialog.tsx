"use client";

import { useContext, useState } from "react";
import { ArrowUpToLineIcon } from "lucide-react";

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
import { update_settings_from_editor } from "~/components/editor/editor-lib";
import { EditorContext } from "~/components/editor/editor-context";
import { useEditorMutations } from "~/hooks/use-editor-mutations";
import { DraftArticleContext } from "~/components/article/context";

export function UploadDialog() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const editor_context = useContext(EditorContext);
  const editor_mutations = useEditorMutations();
  const draft_article = useContext(DraftArticleContext);

  if (!editor_context || !draft_article) return null;

  return (
    <AlertDialog open={dialogOpen} onOpenChange={(open) => setDialogOpen(open)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={async () => {
              const editor_content = await editor_context.editor?.save();
              if (!editor_content) return;

              update_settings_from_editor(draft_article, editor_content);

              setDialogOpen(true);
            }}
            size="icon"
            variant="ghost"
          >
            <ArrowUpToLineIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Shrani in objavi</TooltipContent>
      </Tooltip>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Shrani in objavi</AlertDialogTitle>
          <AlertDialogDescription>
            Ste prepričani, da želite objaviti novico?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Ne objavi</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              await editor_mutations.publish();
              setDialogOpen(false);
            }}
          >
            Objavi
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
