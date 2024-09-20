"use client";

import type { ReactNode } from "react";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import EditorJS from "@editorjs/editorjs";

// @ts-expect-error no types
import DragDrop from "editorjs-drag-drop";
// @ts-expect-error no types
import Undo from "editorjs-undo";

import { editor_store } from "./editor-store";
import { EDITOR_JS_PLUGINS } from "./plugins";
import { update_settings_from_editor, validate_article } from "./editor-lib";
import { DraftArticleContext } from "../article/context";
import { useToast } from "~/hooks/use-toast";
import { get_s3_draft_directory } from "~/lib/article-utils";

export interface EditorContextType {
  editor?: EditorJS;
  savingText: string | undefined;
  setSavingText: (value: string | undefined) => void;
  dirty: boolean;
  setDirty: (value: boolean) => void;
}

export const EditorContext = createContext<EditorContextType | undefined>(
  undefined,
);

export function EditorProvider({ children }: { children: ReactNode }) {
  const article = useContext(DraftArticleContext);
  const [savingText, setSavingText] = useState<string | undefined>();
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  const editorJS = useRef<EditorJS | null>(null);
  const [dirty, setDirty] = useState(false);
  const toaster = useToast();

  useEffect(() => {
    const func = () => true

    if (dirty) {
      addEventListener("beforeunload", func)
    } else {
      removeEventListener("beforeunload", func)
    }

    return () => {
      removeEventListener("beforeunload", func)
    }
  }, [dirty]);

  const content = useMemo(
    () => article?.content ?? NO_CONTENT_EDITOR_VALUE,
    [article],
  );

  const editor_factory = useCallback(() => {
    const onChange = () => {
      setDirty(true);
    };

    const temp_editor = new EditorJS({
      holder: "editorjs",
      tools: EDITOR_JS_PLUGINS(),
      data: content,
      inlineToolbar: true,
      autofocus: true,
      onReady: () => {
        setTimeout(() => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          new Undo({ editor: editorJS.current });
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          new DragDrop(editorJS.current);
        }, 500);

        setTimeout(() => {
          forceUpdate();
        }, 1000);

        async function update_article() {
          editor_store.set.reset();
          const editor_content = await editorJS.current?.save();
          if (!editor_content || !article) return;

          const updated = validate_article(editor_content, toaster);

          update_settings_from_editor({
            title: updated?.title ?? "",
            url: updated?.url ?? "",
            s3_url: get_s3_draft_directory(article.id),
            thumbnail_crop: article.thumbnail_crop,
            editor_content,
            article_id: article.id,
            author_ids: article.draft_articles_to_authors.map(
              (a) => a.author_id,
            ),
          });
        }

        void update_article();
      },
      onChange: (_, event) => {
        if (Array.isArray(event)) {
          for (const _ of event) {
            onChange();
          }
        } else {
          onChange();
        }
      },
    });

    return temp_editor;
  }, [content, article, toaster]);

  useEffect(() => {
    if (editorJS.current != null) return;

    const temp_editor = editor_factory();
    editorJS.current = temp_editor;
  }, [editor_factory]);

  if (!article) return null;

  return (
    <EditorContext.Provider
      value={{
        editor: editorJS.current ?? undefined,
        dirty,
        savingText,
        setSavingText,
        setDirty,
      }}
    >
      {children}
    </EditorContext.Provider>
  );
}

export const NO_CONTENT_EDITOR_VALUE = {
  time: Date.now(),
  blocks: [
    {
      id: "sheNwCUP5A",
      type: "header",
      data: {
        text: "Napaka: ne najdem vsebine",
        level: 1,
      },
    },
  ],
};
