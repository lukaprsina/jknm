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
import type { DraftArticle } from "~/server/db/schema";
import {
  get_clean_url,
  get_heading_from_editor,
  get_image_data_from_editor,
} from "./editor-utils";
import { editor_store } from "./editor-store";
import { EDITOR_JS_PLUGINS } from "./plugins";
import { Button } from "../ui/button";
import { useToast } from "~/hooks/use-toast";

export interface EditorContextType {
  editor?: EditorJS;
  article?: typeof DraftArticle.$inferSelect;
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
  draft_article: typeof DraftArticle.$inferSelect;
}

export const EditorProvider: React.FC<EditorProviderProps> = ({
  children,
  draft_article: article,
}: EditorProviderProps) => {
  const router = useRouter();
  const [savingText, setSavingText] = useState<string | undefined>();
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  const editorJS = useRef<EditorJS | null>(null);
  const [dirty, setDirty] = useState(false);
  const trpc_utils = api.useUtils();
  const toast = useToast();

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
      /* inlineToolbar: [
        // "convert-to",
        // "separator",
        "bold",
        "italic",
        "underline",
        // "separator",
        "link",
        "inline-code",
        "marker",
      ], */
      // inlineToolbar: ["convert-to", "bold", "italic", "underline"],
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

      if (data.url) router.push(`/novica/${data.url}`);
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
        returned_data.content ?? undefined,
      );

      if (!content_preview) {
        console.error("No content preview", returned_data);
      }

      /* await update_algolia_article({
        objectID: returned_data.id.toString(),
        title: returned_data.title,
        url: returned_data.url,
        created_at: returned_data.created_at.getTime(),
        year: returned_data.created_at.getFullYear().toString(),
        content_preview,
        published: true,
        image: returned_data.preview_image ?? undefined,
        author_ids: get_author_names(returned_data, all_authors.data),
      }); */

      // TODO use the old id
      /* const old_article_url = `${get_clean_url(article.url)}-${article.id}`;
      const new_article_url = `${get_clean_url(returned_data.url)}-${returned_data.id}`;

      console.log("Renaming S3 directory", {
        old_article_url,
        new_article_url,
        article,
        returned_data,
      });

      if (old_article_url !== new_article_url) {
        await rename_s3_directory(old_article_url, new_article_url);
      }

      const editor_content = await editorJS.current.save();
      const image_data = get_image_data_from_editor(editor_content);
      const file_data = get_file_data_from_editor(editor_content);
      const urls_to_keep = image_data.map((image) => image.file.url);
      urls_to_keep.push(...file_data.map((file) => file.file.url));

      if (returned_data.preview_image)
        urls_to_keep.push(returned_data.preview_image);

      if (returned_data.draft_preview_image)
        urls_to_keep.push(returned_data.draft_preview_image);

      const spliced_urls = urls_to_keep.map((image_url) => {
        // get the last part of the url
        const parts = image_url.split("/");
        const filename = parts.slice(-1).join("/");
        return decodeURIComponent(filename);
      });

      console.log("Cleaning S3 directory", {
        new_article_url,
        spliced_urls,
      });

      await clean_s3_directory(new_article_url, spliced_urls); */

      setSavingText(undefined);
      setDirty(false);

      await trpc_utils.article.invalidate();

      router.replace(`/novica/${returned_data.url}`);
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
    const new_url = get_clean_url(new_title);

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

function NoHeadingButton({ editor }: { editor: EditorJS }) {
  return (
    <Button
      onClick={() => {
        editor.blocks.insert(
          "header",
          { text: "Neimenovana novica", level: 1 },
          undefined,
          0,
          true,
          false,
        );
      }}
    >
      Dodaj naslov
    </Button>
  );
}

function WrongHeadingButton({
  editor,
  title,
}: {
  editor: EditorJS;
  title?: string;
}) {
  return (
    <Button
      onClick={() => {
        editor.blocks.insert(
          "header",
          { text: title ?? "Neimenovana novica", level: 1 },
          undefined,
          0,
          true,
          true,
        );
      }}
    >
      Popravi naslov
    </Button>
  );
}

/* url?: string */
function update_settings_from_editor(
  article: typeof DraftArticle.$inferSelect,
  editor_content: OutputData,
  title?: string,
) {
  const image_data = get_image_data_from_editor(editor_content);
  const preview_image = editor_store.get.preview_image();

  editor_store.set.state((draft) => {
    if (!preview_image) {
      if (article.preview_image) {
        draft.preview_image = article.preview_image;
      } else {
        draft.preview_image = image_data.at(0)?.file.url;
      }
    }

    draft.image_data = image_data;
    draft.id = article.id;
    draft.image_data = image_data;
    if (typeof title !== "undefined") draft.title = title;
    //  if (typeof url !== "undefined") draft.url = url;

    // TODO
    // draft.google_ids = article.author_ids ?? [];
    // draft.custom_author_names = article.custom_author_names ?? [];
  });
}

function rename_files_in_editor(editor_content: OutputData, new_dir: string) {
  console.log("Renaming files in editor", { editor_content, new_dir });

  for (const block of editor_content.blocks) {
    if (!block.id || !["image", "attaches"].includes(block.type)) {
      console.log("Skipping block", block.type);
      continue;
    }

    const file_data = block.data as { file: { url: string } };
    const new_url = rename_file(file_data.file.url, new_dir);
    console.log("Renamed file", { old_url: file_data.file.url, new_url });
    file_data.file.url = new_url;
  }
}

function rename_file(old_url: string, new_dir: string) {
  const url_parts = new URL(old_url);
  const file_name = url_parts.pathname.split("/").pop();
  if (!file_name) {
    console.error("No name in URL", old_url);
    return old_url;
  }

  const new_url = `${url_parts.protocol}//${url_parts.hostname}/${new_dir}/${file_name}`;
  return new_url;
}

const NO_CONTENT_EDITOR_VALUE = {
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
