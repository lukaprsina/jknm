"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import EditorJS from "@editorjs/editorjs";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";

import { article_variants, page_variants } from "~/lib/page-variants";
import {
  test_strong_bold,
  rename_all_files,
  content_size_stats,
  sync_with_algolia,
} from "./converter-server";
import { iterate_over_articles } from "./converter-spaghetti";
import { cn } from "~/lib/utils";
import { EDITOR_JS_PLUGINS } from "~/components/editor/plugins";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "~/hooks/use-toast";
import { sync_duplicate_urls } from "~/server/article/sync-duplicate-urls";
import { AllAuthorsContext } from "../provider";

export function ArticleConverter() {
  const editorJS = useRef<EditorJS | null>(null);

  const [doSplice, setDoSplice] = useState(true);
  const [doDryRun, setDoDryRun] = useState(true);
  const [doUpdate, setDoUpdate] = useState(false);
  const [doDimensions, setDoDimensions] = useState(false);
  const [firstArticle, setFirstArticle] = useState("23");
  const [lastArticle, setLastArticle] = useState("24");
  const all_authors = use(AllAuthorsContext);
  const toaster = useToast();
  const query_client = useQueryClient();

  // const sync_duplicate_urls = api.article.sync_duplicate_urls.useMutation();
  const sync_duplicate_urls_mutation = useMutation({
    mutationFn: () => sync_duplicate_urls(),
    onSettled: async () => {
      await query_client.invalidateQueries({
        queryKey: ["infinite_published"],
      });
    },
    onError: (error) => {
      toaster.toast({
        title: "Napaka pri sinhroniziranju novičk",
        description: error.message,
      });
    },
  });

  return (
    <div className={cn(article_variants(), page_variants())}>
      <div className="flex w-full flex-wrap gap-4">
        <Button onClick={() => rename_all_files()}>
          Preimenuj vse datoteke B2
        </Button>
        <Button onClick={() => test_strong_bold()}>
          Testiraj strong, bold
        </Button>
        <Button onClick={() => content_size_stats()}>
          Povprečna velikost teksta
        </Button>
        {/* <Button onClick={() => delete_articles()}>Delete articles</Button> */}
        {/* <Button
          variant="destructive"
          onClick={() => delete_s3_published_bucket()}
        >
          Delete s3 published bucket
        </Button> */}
        {/* <Button onClick={() => delete_authors()}>Delete authors</Button> */}
        {/* <Button onClick={() => sync_authors()}>Sync authors</Button> */}
        <Button onClick={() => sync_duplicate_urls_mutation.mutate()}>
          Sync duplicate urls
        </Button>
        <Button onClick={() => sync_with_algolia()}>Sync with Algolia</Button>
        {/* <Button onClick={() => copy_and_rename_images()}>
          Copy and rename images
        </Button> */}
        <div className="flex flex-shrink gap-2">
          <Input
            value={firstArticle}
            onChange={(event) => setFirstArticle(event.target.value)}
          />
          <Input
            value={lastArticle}
            onChange={(event) => setLastArticle(event.target.value)}
          />
          <div className="flex flex-grow items-center gap-2">
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
            <Checkbox
              checked={doDimensions}
              onCheckedChange={(checked) => setDoDimensions(checked === true)}
              id="do_dimensions"
            />
            <label
              htmlFor="do_dimensions"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Do dimensions?
            </label>
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
          </div>
          <Button
            onClick={async () => {
              console.clear();

              await iterate_over_articles(
                editorJS.current,
                all_authors,
                doSplice,
                doDryRun,
                doUpdate,
                doDimensions,
                parseInt(firstArticle),
                parseInt(lastArticle),
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
