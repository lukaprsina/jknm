"use client";

import { useState } from "react";
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
import { useEditor } from "~/components/editor/editor-context";
import { update_settings_from_editor } from "~/components/editor/editor-lib";
import { editor_store } from "~/components/editor/editor-store";

export function UploadDialog() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const editor = useContext(EditorContext);

  if (!editor) return null;

  return (
    <AlertDialog open={dialogOpen} onOpenChange={(open) => setDialogOpen(open)}>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* <AlertDialogTrigger asChild> */}
          <Button
            onClick={async () => {
              const editor_content = await editor.editor?.save();
              if (!editor.article || !editor_content) return;

              update_settings_from_editor(editor.article, editor_content);
              setDialogOpen(true);
            }}
            size="icon"
            variant="ghost"
          >
            <ArrowUpToLineIcon />
          </Button>
          {/* </AlertDialogTrigger> */}
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
              if (!editor.article?.id) {
                console.error("Article ID is missing.");
                return;
              }

              const editor_content =
                await editor.configure_article_before_publish();
              console.log(
                "ZZZZZZZZZZZZ",
                editor_store.get.google_ids(),
                editor_store.get.custom_author_names(),
              );
              // TODO
              /* editor.mutations.publish({
                id: editor.article.id,
                created_at: editor.article.created_at,
                content: editor_content,
                title: editor_store.get.title(),
                url: editor_store.get.url(),
                preview_image: editor_store.get.preview_image() ?? "",
                author_ids: editor_store.get.google_ids(),
                custom_author_names: editor_store.get.custom_author_names(),
              }); */
            }}
          >
            Objavi
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}