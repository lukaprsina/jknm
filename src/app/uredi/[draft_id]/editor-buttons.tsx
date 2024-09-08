"use client";

import { DownloadIcon, SaveIcon, UploadIcon, XIcon } from "lucide-react";

import "./editor.css";

import type { OutputData } from "@editorjs/editorjs";
import { useCallback, useEffect, useRef } from "react";

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
import { useEditor } from "~/components/editor/editor-context";
import { UploadDialog } from "./upload-dialog";
import { SettingsDialog } from "./settings-dialog";

export function EditorButtons() {
  return (
    <div className="flex items-center">
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
  const editor = useEditor();

  if (!editor) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={async () => {
            const editor_content = await editor.editor?.save();
            const blob = new Blob([JSON.stringify(editor_content, null, 2)], {
              type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${editor.article?.title ?? "novica"}.json`;
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
  const editor = useEditor();
  const input_ref = useRef<HTMLInputElement>(null);
  const form_ref = useRef<HTMLFormElement>(null);

  if (!editor) return null;

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
            console.log("input onChange event", file);
            if (!file) return;

            const file_content = await file.text();
            const parsed_file = JSON.parse(file_content) as OutputData;
            console.log("file", file, parsed_file);
            await editor.editor?.render(parsed_file);
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
                console.log("input_ref", input_ref);
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
  const editor = useEditor();

  const save_callback = useCallback(async () => {
    if (!editor?.article?.id) {
      console.error("Article ID is missing.");
      return;
    }

    const editor_content = await editor.editor?.save();

    // TODO
    /* editor.mutations.save_draft({
      id: editor.article.id,
      content: editor_content,
      preview_image: editor_store.get.preview_image() ?? "",
    }); */
  }, [editor]);

  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if (!editor?.article?.id) return;

      if (event.key !== "s" || !event.ctrlKey) return;

      event.preventDefault();

      void save_callback();
    },
    [editor?.article?.id, save_callback],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyPress);

    return () => {
      document.removeEventListener("keydown", handleKeyPress);
    };
  });

  if (!editor) return null;

  return (
    <div className="not-prose flex gap-1 text-sm">
      {typeof editor.savingText === "undefined" ? (
        <p className="h-full pt-3">{editor.savingText}</p>
      ) : null}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={() => save_callback()}>
            <SaveIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Shrani</TooltipContent>
      </Tooltip>
    </div>
  );
}

export function ClearButton() {
  const editor = useEditor();

  if (!editor) return null;

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
          <AlertDialogAction
            onClick={() => {
              if (!editor.article?.id) {
                console.error("Article ID is missing.");
                return;
              }

              editor.mutations.delete_draft(editor.article.id);
            }}
          >
            Izbriši osnutek
          </AlertDialogAction>
          <AlertDialogCancel>Prekliči</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
