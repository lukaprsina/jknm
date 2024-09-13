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

// const Toolbar = dynamic(() => import("./toolbar"), { ssr: false });

export default function MyEditor({
  draft,
  published,
}: {
  draft: DraftArticleWithAuthors;
  published?: PublishedArticleWithAuthors;
}) {
  // console.log("my editor draft", draft);
  return (
    <DraftArticleContext.Provider value={draft}>
      <PublishedArticleContext.Provider value={published}>
        <EditorProvider>
          <Card className="mx-auto w-full">
            <CardHeader>
              <MyToolbar />
            </CardHeader>
            <CardContent>
              <div id="editorjs" />
            </CardContent>
          </Card>
          <SettingsSummary />
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

export interface SaveCallbackProps {
  variables?: Partial<DraftArticleWithAuthors>;
  update?: Partial<{ draft: boolean; content: boolean }> | false;
  redirect_to?: string | false;
}

export type SaveCallbackType = (props: SaveCallbackProps) => Promise<void>;
