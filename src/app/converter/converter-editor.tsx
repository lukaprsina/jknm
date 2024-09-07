"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import EditorJS from "@editorjs/editorjs";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";

import { article_variants, page_variants } from "~/lib/page-variants";
import {
  delete_articles,
  delete_authors,
  get_article_count,
  sync_authors,
  sync_with_algolia,
  copy_and_rename_images,
  get_authors_server,
} from "./converter-server";
import { iterate_over_articles } from "./converter-spaghetti";
import { cn } from "~/lib/utils";
import { EDITOR_JS_PLUGINS } from "~/components/editor/plugins";

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
  const [doUpdate, setDoUpdate] = useState(false);
  const [firstArticle, setFirstArticle] = useState("625"); // 32
  const [lastArticle, setLastArticle] = useState("-1");

  return (
    <div className={cn(article_variants(), page_variants())}>
      <h1>Article Converter: {article_count} novičk</h1>
      <div className="flex w-full flex-wrap gap-4">
        <Button onClick={() => delete_articles()}>Delete articles</Button>
        <Button onClick={() => delete_authors()}>Delete authors</Button>
        <Button onClick={() => sync_authors()}>Sync authors</Button>
        <Button onClick={() => sync_with_algolia()}>Sync with Algolia</Button>
        <Button onClick={() => copy_and_rename_images()}>
          Copy and rename images
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
              await iterate_over_articles(
                editorJS.current,
                doSplice,
                doDryRun,
                doUpdate,
                parseInt(firstArticle),
                parseInt(lastArticle),
                await get_authors_server(),
              );
            }}
          >
            Convert
          </Button>
        </div>
      </div>
      <TempEditor editorJS={editorJS} />
    </div>
  );
}

export function TempEditor({
  editorJS,
}: {
  editorJS: React.MutableRefObject<EditorJS | null>;
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
    if (editorJS.current) return;

    const temp_editor = editor_factory();
    editorJS.current = temp_editor;
  }, [editor_factory, editorJS]);

  return <div id="editorjs" />;
}
