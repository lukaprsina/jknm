"use client";

import { DownloadIcon, SaveIcon, UploadIcon, XIcon } from "lucide-react";

import type { OutputData } from "@editorjs/editorjs";
import { useCallback, useContext, useEffect, useRef } from "react";

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
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { UploadDialog } from "./upload-dialog";
import { SettingsDialog } from "./settings-dialog";
import { EditorContext } from "~/components/editor/editor-context";
import { DraftArticleContext } from "~/components/article/context";
import { useEditorMutations } from "~/hooks/use-editor-mutations";

export function ToolbarButtons() {
  return (
    <div className="flex flex-wrap items-center">
      <ExportButton />
      <ImportButton />
      <SaveButton />
      <UploadDialog />
      <SettingsDialog />
      <ClearButton />
    </div>
  );
}

export function ExportButton() {
  const editor_context = useContext(EditorContext);
  const draft_article = useContext(DraftArticleContext);

  if (!editor_context || !draft_article) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={async () => {
            const editor_content = await editor_context.editor?.save();
            const blob = new Blob([JSON.stringify(editor_content, null, 2)], {
              type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${draft_article.title}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <DownloadIcon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Izvozi</TooltipContent>
    </Tooltip>
  );
}

export function ImportButton() {
  const editor_context = useContext(EditorContext);
  const input_ref = useRef<HTMLInputElement>(null);
  const form_ref = useRef<HTMLFormElement>(null);

  if (!editor_context) return null;

  return (
    <>
      <form ref={form_ref}>
        <input
          type="file"
          className="hidden"
          accept="application/json"
          ref={input_ref}
          onChange={async (event) => {
            const files = event.target.files;
            const file = files?.item(0);
            // console.log("input onChange event", file);
            if (!file) return;

            const file_content = await file.text();
            const parsed_file = JSON.parse(file_content) as OutputData;
            // console.log("file", file, parsed_file);
            await editor_context.editor?.render(parsed_file);
          }}
        />
      </form>
      <AlertDialog>
        <Tooltip>
          <TooltipTrigger asChild>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <UploadIcon />
              </Button>
            </AlertDialogTrigger>
          </TooltipTrigger>
          <TooltipContent>Uvozi</TooltipContent>
        </Tooltip>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Uvozi novico</AlertDialogTitle>
            <AlertDialogDescription>
              Ste prepričani, da želite uvoziti novico iz računalnika?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ne uvozi</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                form_ref.current?.reset();
                input_ref.current?.click();
              }}
            >
              Uvozi novico
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function SaveButton() {
  const editor_context = useContext(EditorContext);
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

  if (!editor_context) return null;

  return (
    <div className="not-prose flex gap-1 text-sm">
      <span className="pt-3">
        {typeof editor_context.savingText === "undefined"
          ? editor_context.savingText
          : null}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor_mutations.save_draft()}
          >
            <SaveIcon />
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
  const editor_context = useContext(EditorContext);
  const editor_mutations = useEditorMutations();

  if (!editor_context) return null;

  return (
    <AlertDialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon">
              <XIcon />
            </Button>
          </AlertDialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Izbriši osnutek</TooltipContent>
      </Tooltip>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Izbriši osnutek</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription>
          Ste prepričani, da želite izbrisati osnutek na objavljeno različico
          novičke?
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>Prekliči</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              editor_mutations.delete_draft();
            }}
          >
            OK
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
