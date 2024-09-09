"use client";

import "./editor.css";

import type { ComponentType } from "react";
import { useMemo } from "react";
import Image from "next/image";

import { MultiSelect } from "~/components/multi-select";

import type { DraftArticleWithAuthors } from "~/components/article/card-adapter";
import { EditorProvider, useEditor } from "~/components/editor/editor-context";
import { editor_store } from "~/components/editor/editor-store";
import { useAllAuthors } from "~/components/authors";
import { cn } from "~/lib/utils";
import { EditorButtons } from "./editor-buttons";

export default function MyEditor() {
  return (
    <EditorProvider>
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
  variables?: Partial<DraftArticleWithAuthors>;
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
  const all_authors = useAllAuthors();

  const authors = useMemo(() => {
    if (!all_authors) return [];

    const google_authors = all_authors
      .map(
        (user) =>
          ({
            label: user.name,
            value: JSON.stringify({ source: "google", id: user.id }),
            icon: ({ className }: { className?: string }) => {
              if (!user.image || !user.name) return;

              return (
                <Image
                  src={user.image}
                  alt={user.name}
                  width={16}
                  height={16}
                  loader={({ src }) => src}
                  className={cn("rounded-full", className)}
                />
              );
            },
          }) satisfies AuthorMultiSelectType,
      )
      .filter((mapped_user) => {
        return mapped_user.label && mapped_user.value;
      });

    return google_authors;
  }, [all_authors]);

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
        <EditorButtons />
      </div>
    </div>
  );
}
