"use client";

import "./editor.css";

import type { DraftArticleWithAuthors } from "~/components/article/card-adapter";
import { EditorProvider } from "~/components/editor/editor-context";
import { editor_store } from "~/components/editor/editor-store";
import { DraftArticleContext } from "~/components/article/context";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import dynamic from "next/dynamic";

const Toolbar = dynamic(() => import("./toolbar"), { ssr: false });

export default function MyEditor({
  draft,
}: {
  draft: DraftArticleWithAuthors;
}) {
  console.log("my editor draft", draft);
  return (
    <DraftArticleContext.Provider value={draft}>
      <EditorProvider>
        <Card className="mx-auto w-full">
          <CardHeader>
            <Toolbar />
          </CardHeader>
          <CardContent>
            <div id="editorjs" />
          </CardContent>
        </Card>
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
