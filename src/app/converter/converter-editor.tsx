"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import EditorJS from "@editorjs/editorjs";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { ScrollArea } from "~/components/ui/scroll-area";

import { article_variants, page_variants } from "~/lib/page-variants";
import { api } from "~/trpc/react";
import {
  delete_articles,
  get_article_count,
  get_authors_by_name,
  read_articles,
  sync_with_algolia,
  upload_images,
} from "./converter-server";
import { iterate_over_articles } from "./converter-spaghetti";
import { cn } from "~/lib/utils";

export function ArticleConverter() {
  const editorJS = useRef<EditorJS | null>(null);
  const [article_count, setArticleCount] = useState<number | undefined>(
    undefined,
  );

  useEffect(() => {
    void (async () => {
      const article_count = await get_article_count();
      setArticleCount(article_count);
    })();
  }, []);

  const [doSplice, setDoSplice] = useState(true);
  const [doDryRun, setDoDryRun] = useState(true);
  const [doUpdate, setDoUpdate] = useState(true);
  const [firstArticle, setFirstArticle] = useState("0"); // 32
  const [lastArticle, setLastArticle] = useState("33");
  const all_authors = api.author.get_authors.useQuery();

  return (
    <div className={cn(article_variants(), page_variants())}>
      <h1>Article Converter: {article_count} novičk</h1>
      <div className="flex w-full flex-wrap gap-4">
        <Button
          onClick={async () => {
            await sync_with_algolia();
          }}
        >
          Sync with Algolia
        </Button>
        <Button
          onClick={async () => {
            await delete_articles();
          }}
        >
          Delete articles
        </Button>
        <Button
          onClick={async () => {
            if (!all_authors.data) {
              console.warn("Authors not loaded");
              return;
            }

            const not_found_authors = new Set<string>();
            const authors_by_name = await get_authors_by_name();

            for (const author_by_name of authors_by_name) {
              let author = author_by_name.name;

              if (typeof author_by_name.change === "boolean") {
                continue;
              } else if (typeof author_by_name.change === "string") {
                author = author_by_name.change;
              }

              author = author.trim();
              author.split(", ").forEach((split_author) => {
                const author_obj = all_authors.data?.find(
                  (a) => a.name === split_author,
                );

                if (!author_obj) {
                  console.log(split_author);
                  not_found_authors.add(split_author);
                }
              });
            }

            const mapped_authors = all_authors.data.map((a) => a.name);
            console.log(
              "not_found_authors",
              mapped_authors,
              Array.from(not_found_authors),
            );
          }}
        >
          Check authors
        </Button>
        <Button
          onClick={async () => {
            await upload_images();
          }}
        >
          Copy images to S3
        </Button>
        <div className="flex flex-shrink gap-2">
          <Input
            value={firstArticle}
            onChange={(event) => setFirstArticle(event.target.value)}
          />
          <Input
            value={lastArticle}
            onChange={(event) => setLastArticle(event.target.value)}
          />
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={doSplice}
              onCheckedChange={(checked) => setDoSplice(checked === true)}
              id="do_splice"
            />
            <label
              htmlFor="do_splice"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Splice?
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={doDryRun}
              onCheckedChange={(checked) => setDoDryRun(checked === true)}
              id="do_dry"
            />
            <label
              htmlFor="do_dry"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Dry run?
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={doUpdate}
              onCheckedChange={(checked) => setDoUpdate(checked === true)}
              id="do_update"
            />
            <label
              htmlFor="do_update"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Update?
            </label>
          </div>
          <Button
            onClick={async () => {
              console.clear();
              const csv_articles = await read_articles();

              await iterate_over_articles(
                csv_articles,
                editorJS.current,
                doSplice,
                doDryRun,
                doUpdate,
                parseInt(firstArticle),
                parseInt(lastArticle),
                all_authors.data,
              );
            }}
          >
            Convert
          </Button>
        </div>
      </div>
      <ScrollArea className="my-4 h-72 rounded-md">
        <pre>{JSON.stringify(all_authors.data, null, 2)}</pre>
      </ScrollArea>
      <TempEditor editorJS={editorJS} />
    </div>
  );
}

export function TempEditor({
  editorJS,
}: {
  editorJS: React.RefObject<EditorJS | null>;
}) {
  const editor_factory = useCallback(() => {
    const temp_editor = new EditorJS({
      holder: "editorjs",
      tools: EDITOR_JS_PLUGINS(),
      autofocus: true,
    });

    return temp_editor;
  }, []);

  useEffect(() => {
    if (editorJS.current != null) return;

    const temp_editor = editor_factory();
    editorJS.current = temp_editor;
  }, [editor_factory, editorJS]);

  return <div id="editorjs" />;
}
