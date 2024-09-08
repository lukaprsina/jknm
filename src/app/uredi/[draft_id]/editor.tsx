"use client";

import { DownloadIcon, SaveIcon, UploadIcon, XIcon } from "lucide-react";

import "./editor.css";

import type { OutputData } from "@editorjs/editorjs";
import type { ComponentType } from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import Image from "next/image";

import type { Article } from "@acme/db/schema";
import { cn } from "@acme/ui";
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
} from "@acme/ui/alert-dialog";
import { Button } from "@acme/ui/button";
import { MultiSelect } from "@acme/ui/multi-select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@acme/ui/tooltip";

import { EditorProvider, useEditor } from "~/components/editor-context";
import { api } from "~/trpc/react";
import { editor_store } from "./editor-store";
import { SettingsDialog } from "./settings-dialog";
import { UploadDialog } from "./upload-dialog";

export default function MyEditor({
  article,
}: {
  article?: typeof Article.$inferSelect;
}) {
  return (
    <EditorProvider article={article}>
      <div className="mx-auto w-full outline outline-1">
        <MyToolbar />
        <div id="editorjs" />
      </div>
      <SettingsSummary />
    </EditorProvider>
  );
}

function SettingsSummary() {
  const data = editor_store.useStore();
  return (
    <pre className="my-8 h-full overflow-auto">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export interface SaveCallbackProps {
  variables?: Partial<typeof Article.$inferSelect>;
  update?: Partial<{ draft: boolean; content: boolean }> | false;
  redirect_to?: string | false;
}

export type SaveCallbackType = (props: SaveCallbackProps) => Promise<void>;

interface AuthorMultiSelectType {
  label: string;
  value: string;
  icon?: ComponentType<{ className?: string | undefined }>;
}

export interface AuthorValueMultiSelectType {
  source: "google" | "custom";
  id?: string;
  name?: string;
}

function MyToolbar() {
  const editor = useEditor();
  const all_authors = api.article.google_users.useQuery();

  const authors = useMemo(() => {
    if (!all_authors.data) return [];

    const google_authors = all_authors.data
      .filter((user) => {
        if (user.suspended) return false;
        return true;
      })
      .map((user) => ({
        label: user.name,
        value: JSON.stringify({ source: "google", id: user.id }),
        icon: ({ className }: { className: string | undefined }) => {
          if (!user.thumbnail || !user.name) return;

          return (
            <Image
              src={user.thumbnail}
              alt={user.name}
              width={16}
              height={16}
              loader={({ src }) => src}
              className={cn("rounded-full", className)}
            />
          );
        },
      }))
      .filter((mapped_user) => {
        return mapped_user.label && mapped_user.value;
      });

    return google_authors as AuthorMultiSelectType[];
  }, [all_authors.data]);

  if (!editor) return null;
  return (
    <div className="flex flex-col justify-between gap-4">
      <div className="flex w-full items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <MultiSelect
            onValueChange={(value) => {
              const google_ids: string[] = [];
              const custom_author_names: string[] = [];

              for (const author_string of value) {
                const author_value = JSON.parse(
                  author_string,
                ) as AuthorValueMultiSelectType;
                if (author_value.source === "google") {
                  google_ids.push(author_value.id ?? "");
                } else {
                  custom_author_names.push(author_value.name ?? "");
                }
              }

              editor_store.set.google_ids(google_ids);
              editor_store.set.custom_author_names(custom_author_names);
            }}
            defaultValue={[]}
            options={authors}
            placeholder="Avtorji"
            animation={2}
            maxCount={3}
          />
          <span className="flex flex-shrink-0">{editor.savingText}</span>
        </div>
        <div className="flex items-center">
          <ExportButton />
          <ImportButton />
          <SaveButton />
          <UploadDialog />
          <SettingsDialog />
          <ClearButton />
        </div>
      </div>
    </div>
  );
}

function ExportButton() {
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

function ImportButton() {
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

function SaveButton() {
  const editor = useEditor();

  const save_callback = useCallback(async () => {
    if (!editor?.article?.id) {
      console.error("Article ID is missing.");
      return;
    }

    const editor_content = await editor.editor?.save();

    editor.mutations.save_draft({
      id: editor.article.id,
      draft_content: editor_content,
      draft_preview_image: editor_store.get.preview_image() ?? "",
    });
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

function ClearButton() {
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

              editor.mutations.delete_draft({ id: editor.article.id });
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
