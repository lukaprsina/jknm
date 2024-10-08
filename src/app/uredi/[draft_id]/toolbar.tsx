"use client";

import { useContext, useMemo } from "react";

import type { MultiSelectProps } from "~/components/multi-select";
import { MultiSelect } from "~/components/multi-select";

import { EditorContext } from "~/components/editor/editor-context";
import { editor_store } from "~/components/editor/editor-store";
import { ToolbarButtons } from "./toolbar-buttons";
import { cached_state_store } from "~/app/provider";

export function MyToolbar() {
  const editor_context = useContext(EditorContext);
  const all_authors = cached_state_store.get.all_authors();
  const author_ids = editor_store.use.author_ids();

  const selected_author_ids = useMemo(() => {
    // console.log("toolbar -> author_ids", author_ids, typeof author_ids);
    return author_ids.map((id) => id.toString());
  }, [author_ids]);

  const authors = useMemo(() => {
    return all_authors
      .map(
        (user) =>
          ({
            label: user.name,
            value: user.id.toString(),
            icon: undefined,
            /*icon: ({ className }: { className?: string }) => {
              if (!user.image || !user.name) return;

              return (
                <Image
                  src={user.image}
                  alt={user.name}
                  width={16}
                  height={16}
                  className={cn("m-0 rounded-full", className)}
                />
              );
            },*/
          }) satisfies MultiSelectProps["options"]["0"],
      )
      .filter((mapped_user) => {
        return mapped_user.label && mapped_user.value;
      });
  }, [all_authors]);

  if (!editor_context) return null;
  return (
    <div className="flex flex-col justify-between gap-4">
      <div className="flex w-full flex-wrap items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <MultiSelect
            onValueChange={(value) => {
              const ids = value.map((v) => parseInt(v));
              // console.log("toolbar -> onValueChange", ids);
              editor_store.set.author_ids(ids);
            }}
            defaultValue={selected_author_ids}
            options={authors}
            placeholder="Avtorji"
            animation={2}
            maxCount={3}
          />
          <span className="flex flex-shrink-0">
            {editor_context.savingText}
          </span>
        </div>
        <ToolbarButtons />
      </div>
    </div>
  );
}
