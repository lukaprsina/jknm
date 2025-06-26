"use client";

import React, { useState, useCallback, useRef } from "react";
import type EditorJS from "@editorjs/editorjs";
import { article_variants, page_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { get_article_by_id, get_embeds as log_embeds, save_markdown_articles } from "./new-server";
import dynamic from "next/dynamic";
import type { Articles } from "./page";
import { Input } from "~/components/ui/input";
import { PublishedArticle } from "~/server/db/schema";

const DynamicTempEditor = dynamic(
  () =>
    import("./temp-editor").then((mod) => ({
      default: mod.TempEditor,
    })),
  {
    ssr: false,
  },
);

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
const MDfromBlocks = async () =>
  await import("~/../vendor/editorjs-md-parser/src/MarkdownParser").then(
    (mod) => mod.parseToMarkdown,
  );

export type MarkdownArticle = { id: number; markdown: string };

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const parseMarkdown = await MDfromBlocks();

export function ArticleConverter({ articles }: { articles: Articles }) {
  const editorJS = useRef<EditorJS | null>(null);
  const [dbId, setDbId] = useState<string | null>("2");


  const convert_everything = useCallback(async () => {
    const markdowns: MarkdownArticle[] = [];

    for (const article of articles) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const markdown = (await parseMarkdown(
        article.content?.blocks ?? "",
      )) as unknown;

      if (typeof markdown === "string") {
        markdowns.push({ id: article.id, markdown });
      }
    }

    await save_markdown_articles(markdowns);
    console.log("Converted all articles to markdown", markdowns.length);
  }, [articles]);

  return (
    <div className={cn(article_variants(), page_variants())}>
      <div className="flex w-full flex-wrap gap-4">
        <Input
          type="number"
          placeholder="DB ID"
          value={dbId ?? ""}
          onChange={(e) => setDbId(e.target.value)}
        />
        <Button
          onClick={async () => {
            const article = await get_article_by_id(parseInt(dbId!));
            if (!editorJS.current || !article?.content)
              return

            await editorJS.current.render(article.content);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const markdown = await parseMarkdown(article?.content?.blocks) as string;
            console.log("Markdown from DB ID", { dbId, markdown, blocks: article.content?.blocks });
          }}
        >
          Convert one to markdown
        </Button>
        {/* <Button onClick={async () => log_embeds()}>Embeds</Button> */}
        <Button onClick={async () => convert_everything()}>
          Convert all articles
        </Button>
        <Button onClick={async () => {
          const available_plugins = ["header",
            "paragraph",
            "list",
            "image",
            "embed"] as const;

          const find_articles_with_plugin = async (plugin: typeof available_plugins[number]) => {
            return Promise.all(articles.map(article => article.content?.blocks?.some((block) => block.type === plugin) ? article.id : null).filter(Boolean));
          }

          const articles_by_plugin = await Promise.all(available_plugins.map(async (plugin) => {
            const articles = await find_articles_with_plugin(plugin);
            return { plugin, articles }
          }));

          console.log(articles_by_plugin)
        }}>List articles by plugin</Button>

      </div>
      <DynamicTempEditor editorJS={editorJS} />
    </div>
  );
}
