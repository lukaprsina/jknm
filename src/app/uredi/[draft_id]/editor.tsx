"use client";

import "./editor.css";

import { useContext, useMemo } from "react";
import Image from "next/image";

import type { MultiSelectProps } from "~/components/multi-select";
import { MultiSelect } from "~/components/multi-select";

import type { DraftArticleWithAuthors } from "~/components/article/card-adapter";
import {
  EditorContext,
  EditorProvider,
} from "~/components/editor/editor-context";
import { editor_store } from "~/components/editor/editor-store";
import { useAllAuthors } from "~/components/authors";
import { cn } from "~/lib/utils";
import { EditorButtons } from "./editor-buttons";
import { DraftArticleContext } from "~/components/article/context";

export default function MyEditor({
  draft,
}: {
  draft: DraftArticleWithAuthors;
}) {
  return (
    <DraftArticleContext.Provider value={draft}>
      <EditorProvider>
        <div className="mx-auto w-full outline outline-1">
          <MyToolbar />
          <div id="editorjs" />
        </div>
        <SettingsSummary />
      </EditorProvider>
    </DraftArticleContext.Provider>
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

function MyToolbar() {
  const editor_context = useContext(EditorContext);
  const all_authors = useAllAuthors();

  const authors = useMemo(() => {
    if (!all_authors) return [];

    const google_authors = all_authors
      .map(
        (user) =>
          ({
            label: user.name,
            value: user.id.toString(),
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
          }) satisfies MultiSelectProps["options"]["0"],
      )
      .filter((mapped_user) => {
        return mapped_user.label && mapped_user.value;
      });

    return google_authors;
  }, [all_authors]);

  if (!editor_context) return null;
  return (
    <div className="flex flex-col justify-between gap-4">
      <div className="flex w-full items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <MultiSelect
            onValueChange={(value) => {
              editor_store.set.author_ids(value.map((v) => parseInt(v)));
            }}
            defaultValue={[]}
            options={authors}
            placeholder="Avtorji"
            animation={2}
            maxCount={3}
          />
          <span className="flex flex-shrink-0">
            {editor_context.savingText}
          </span>
        </div>
        <EditorButtons />
      </div>
    </div>
  );
}
