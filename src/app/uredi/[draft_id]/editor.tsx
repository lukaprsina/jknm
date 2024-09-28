"use client";

import "./editor.css";

import type {
  DraftArticleWithAuthors,
  PublishedArticleWithAuthors,
} from "~/components/article/adapter";
import { EditorProvider } from "~/components/editor/editor-context";
import { editor_store } from "~/components/editor/editor-store";
import {
  DraftArticleContext,
  PublishedArticleContext,
} from "~/components/article/context";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { MyToolbar } from "./toolbar";
import { cn } from "~/lib/utils";
import { article_variants } from "~/lib/page-variants";
import { api } from "~/trpc/react";
import { format_date_for_human } from "~/lib/format-date";
import { Alert } from "~/components/ui/alert";
import { TriangleAlertIcon } from "lucide-react";

// const Toolbar = dynamic(() => import("./toolbar"), { ssr: false });

export default function MyEditor({
  draft,
  published,
}: {
  draft: DraftArticleWithAuthors;
  published?: PublishedArticleWithAuthors;
}) {
  const store_url = editor_store.use.url();
  const duplicate_urls = api.article.check_if_url_duplicate.useQuery({
    url: store_url,
  });

  return (
    <DraftArticleContext.Provider value={draft}>
      <PublishedArticleContext.Provider value={published}>
        <EditorProvider>
          <div className={cn("flex flex-col gap-6", article_variants())}>
            {duplicate_urls.data?.urls.length !== 0 && (
              <Alert>
                <h3 className="flex gap-2 text-destructive">
                  <TriangleAlertIcon />
                  <span>
                    Opozorilo: Obstajajo že članki z URL <b>{store_url}</b>
                  </span>
                </h3>
                <p>
                  Članki z istim URL-jem bodo imeli dodan datum nastanka v URL,
                  da se izognemo konfliktom.
                </p>
                <ul>
                  {duplicate_urls.data?.urls.map((article) => (
                    <li key={article.id}>
                      ID: {article.id}, ustvarjen na{" "}
                      {format_date_for_human(article.created_at)}
                    </li>
                  ))}
                </ul>
              </Alert>
            )}
            <Card className="mx-auto w-full">
              <CardHeader>
                <MyToolbar />
              </CardHeader>
              <CardContent className="prose-h1:!mb-6 prose-img:!my-0">
                <div id="editorjs" />
              </CardContent>
            </Card>
            <SettingsSummary />
          </div>
        </EditorProvider>
      </PublishedArticleContext.Provider>
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
