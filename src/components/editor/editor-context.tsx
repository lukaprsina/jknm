"use client";

import type { OutputData } from "@editorjs/editorjs";
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
import { useRouter } from "next/navigation";
import EditorJS from "@editorjs/editorjs";
// @ts-expect-error no types
import DragDrop from "editorjs-drag-drop";
// @ts-expect-error no types
import Undo from "editorjs-undo";

import { content_to_text } from "~/lib/content-to-text";
import { api } from "~/trpc/react";
import { editor_store } from "./editor-store";
import { EDITOR_JS_PLUGINS } from "./plugins";
import { useToast } from "~/hooks/use-toast";
import {
  convert_title_to_url,
  get_published_article_link,
} from "~/lib/article-utils";
import { get_heading_from_editor } from "~/lib/editor-utils";
import { useDuplicatedUrls } from "~/hooks/use-duplicated-urls";
import type { DraftArticleWithAuthors } from "../article/card-adapter";
import { NoHeadingButton, WrongHeadingButton } from "./editor-buttons";
import {
  NO_CONTENT_EDITOR_VALUE,
  rename_file,
  rename_files_in_editor,
  update_settings_from_editor,
} from "./editor-lib";

export interface EditorContextType {
  editor?: EditorJS;
  article?: DraftArticleWithAuthors;
  configure_article_before_publish: () => Promise<OutputData | undefined>;
  savingText: string | undefined;
  setSavingText: (value: string | undefined) => void;
  dirty: boolean;
  setDirty: (value: boolean) => void;
  mutations: {
    save_draft: ReturnType<typeof api.article.save_draft.useMutation>["mutate"];
    publish: ReturnType<typeof api.article.publish.useMutation>["mutate"];
    delete_draft: ReturnType<
      typeof api.article.delete_draft.useMutation
    >["mutate"];
    unpublish: ReturnType<typeof api.article.unpublish.useMutation>["mutate"];
    delete_both: ReturnType<
      typeof api.article.delete_both.useMutation
    >["mutate"];
  };
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

export const useEditor = () => {
  return useContext(EditorContext);
};

interface EditorProviderProps {
  children: ReactNode;
  article: DraftArticleWithAuthors;
}

export const EditorProvider: React.FC<EditorProviderProps> = ({
  children,
  article,
}: EditorProviderProps) => {
  const router = useRouter();
  const [savingText, setSavingText] = useState<string | undefined>();
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  const editorJS = useRef<EditorJS | null>(null);
  const [dirty, setDirty] = useState(false);
  const trpc_utils = api.useUtils();
  const toast = useToast();
  const duplicate_urls = useDuplicatedUrls();

  useEffect(() => {
    if (dirty) {
      console.log("dirty");
      window.onbeforeunload = () => true;
    } else {
      console.log("clean");
      window.onbeforeunload = null;
    }
  }, [dirty]);

  const content = useMemo(
    () => article.content ?? NO_CONTENT_EDITOR_VALUE,
    [article],
  );

  const editor_factory = useCallback(() => {
    // api: API, event: BlockMutationEvent | BlockMutationEvent[]
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

        if (!editorJS.current) {
          console.error("No editorJS.current");
          return;
        }

        async function update_article() {
          const editor_content = await editorJS.current?.save();
          if (!editor_content) return;
          editor_store.set.reset();

          update_settings_from_editor(article, editor_content, article.title);
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
  }, [content, article]);

  const save_draft = api.article.save_draft.useMutation({
    onMutate: () => {
      if (!article.id) {
        console.error("Article ID is missing.");
        return;
      }

      setSavingText("Shranjujem osnutek ...");
    },
    onSuccess: async () => {
      if (!editorJS.current) return;
      const editor_content = await editorJS.current.save();

      update_settings_from_editor(article, editor_content);

      setSavingText(undefined);
      setDirty(false);

      await trpc_utils.article.invalidate();
    },
  });

  const delete_draft = api.article.delete_draft.useMutation({
    onMutate: () => {
      if (!article.id) {
        console.error("Article ID is missing.");
        return;
      }

      setSavingText("Brišem osnutek ...");
    },
    onSuccess: async (data) => {
      if (!editorJS.current) return;

      setSavingText(undefined);

      await trpc_utils.article.invalidate();

      if (data.url) {
        router.push(
          get_published_article_link(
            data.url,
            data.draft.created_at,
            duplicate_urls,
          ),
        );
      }
    },
  });

  const publish = api.article.publish.useMutation({
    onMutate: () => {
      if (!article.id) {
        console.error("Article ID is missing.");
        return;
      }

      setSavingText("Objavljam spremembe ...");
    },
    onSuccess: async (data) => {
      const returned_data = data;
      if (!editorJS.current || !returned_data) return;
      console.warn("published", returned_data);

      const content_preview = content_to_text(
        returned_data.content?.blocks ?? undefined,
      );

      if (!content_preview) {
        console.error("No content preview", returned_data);
      }

      setSavingText(undefined);
      setDirty(false);

      await trpc_utils.article.invalidate();

      if (data.url) {
        router.push(
          get_published_article_link(data.url, data.created_at, duplicate_urls),
        );
      }
    },
  });

  const unpublish = api.article.unpublish.useMutation({
    onMutate: () => {
      setSavingText("Skrivam novičko ...");
    },
    onSuccess: async (data) => {
      const returned_data = data.at(0);
      if (!returned_data) return;

      setSavingText(undefined);

      /* await update_algolia_article({
        objectID: returned_data.id.toString(),
        published: false,
        has_draft: true,
      }); */

      await trpc_utils.article.invalidate();
    },
  });

  const delete_both = api.article.delete_both.useMutation({
    onMutate: () => {
      setSavingText("Brišem novičko ...");
    },
    // eslint-disable-next-line @typescript-eslint/require-await
    onSuccess: async (_data) => {
      /* const returned_data = data.at(0);
      if (!returned_data) return;

      await delete_algolia_article(returned_data.id.toString());
      await delete_s3_directory(`${returned_data.url}-${returned_data.id}`);
      await trpc_utils.article.invalidate(); */

      router.replace(`/`);
    },
  });

  useEffect(() => {
    if (editorJS.current != null) return;

    const temp_editor = editor_factory();
    editorJS.current = temp_editor;
  }, [editor_factory]);

  const configure_article_before_publish = useCallback(async () => {
    if (!editorJS.current) return;

    let editor_content = await editorJS.current.save();

    const { title: new_title, error } = get_heading_from_editor(editor_content);

    if (error === "NO_HEADING") {
      toast.toast({
        title: "Naslov ni nastavljen",
        description: "Prva vrstica mora biti H1 naslov.",
        action: <NoHeadingButton editor={editorJS.current} />,
      });
    } else if (error === "WRONG_HEADING_LEVEL") {
      toast.toast({
        title: "Naslov ni pravilne ravni",
        description: "Prva vrstica mora biti H1 naslov.",
        action: (
          <WrongHeadingButton editor={editorJS.current} title={new_title} />
        ),
      });
    }

    if (!new_title) return;
    const new_url = convert_title_to_url(new_title);

    const new_article_url = `${new_url}-${article.id}`;

    editor_content = await editorJS.current.save();
    rename_files_in_editor(editor_content, new_article_url);

    // TODO
    // update_settings_from_editor(article, editor_content, new_title, new_url);

    const preview_image = editor_store.get.preview_image();

    const new_preview_image = preview_image
      ? rename_file(preview_image, new_article_url)
      : undefined;

    editor_store.set.preview_image(new_preview_image);

    return editor_content;
  }, [article, toast]);

  return (
    <EditorContext.Provider
      value={{
        article,
        editor: editorJS.current ?? undefined,
        dirty,
        savingText,
        setSavingText,
        setDirty,
        configure_article_before_publish,
        mutations: {
          save_draft: save_draft.mutate,
          delete_draft: delete_draft.mutate,
          publish: publish.mutate,
          unpublish: unpublish.mutate,
          delete_both: delete_both.mutate,
        },
      }}
    >
      {children}
    </EditorContext.Provider>
  );
};
