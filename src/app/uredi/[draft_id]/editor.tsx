"use client";

import "./editor.css";

import type {
  DraftArticleWithAuthors,
  PublishedArticleWithAuthors,
} from "~/components/article/card-adapter";
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

// const Toolbar = dynamic(() => import("./toolbar"), { ssr: false });

export default function MyEditor({
  draft,
  published,
}: {
  draft: DraftArticleWithAuthors;
  published?: PublishedArticleWithAuthors;
}) {
  return (
    <DraftArticleContext.Provider value={draft}>
      <PublishedArticleContext.Provider value={published}>
        <EditorProvider>
          <div className={cn("flex flex-col gap-6", article_variants())}>
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
