"use client";

import { useRef, useState } from "react";
import EditorJS from "@editorjs/editorjs";
// @ts-expect-error no types for this package
import { MDfromBlocks } from 'editorjs-md-parser';

import { article_variants, page_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { get_article_by_id, get_embeds as log_embeds } from "./new-server";
import { TempEditor } from "./temp-editor";

export function ArticleConverter() {
  const editorJS = useRef<EditorJS | null>(null);
  const [dbId, setDbId] = useState<string | null>(null);

  return (
    <div className={cn(article_variants(), page_variants())}>
      <div className="flex w-full flex-wrap gap-4">
        <Input type="number" placeholder="DB ID" value={dbId ?? ""} onChange={(e) => setDbId(e.target.value)} />
        <Button onClick={async () => {
          const article = await get_article_by_id(parseInt(dbId!))
          const markdown = await MDfromBlocks(article?.content?.blocks ?? "")
          console.log("Markdown from DB ID", dbId, markdown);
        }}>Convert to markdown</Button>
        <Button onClick={async () => log_embeds()}>Embeds</Button>
      </div>
      <TempEditor editorJS={editorJS} />
    </div>
  );
}