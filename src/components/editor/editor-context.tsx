"use client";

import EditorJS from "@editorjs/editorjs";
// @ts-expect-error no types
import DragDrop from "editorjs-drag-drop";
// @ts-expect-error no types
import Undo from "editorjs-undo";
import type { ReactNode } from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useReducer,
	useRef,
	useState,
} from "react";
import { useToast } from "~/hooks/use-toast";
import { convert_title_to_url } from "~/lib/article-utils";
import { extract_media_refs_from_content } from "~/lib/editor-utils";
import { DraftArticleContext } from "../article/context";
import { update_settings_from_editor, validate_article } from "./editor-lib";
import { editor_store } from "./editor-store";
import { EDITOR_JS_PLUGINS } from "./plugins";

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

	// Seeded synchronously during render (not in an effect/onReady) so the
	// toolbar and settings panel never paint a previous draft's state —
	// EditorJS's async `onReady` only needs to report content-derived fields.
	const seeded_draft_id = useRef<string | null>(null);
	if (article && seeded_draft_id.current !== article.id) {
		seeded_draft_id.current = article.id;

		editor_store.set("state", (draft) => {
			draft.draft_id = article.id;
			draft.title = article.title;
			draft.url = convert_title_to_url(article.title);
			draft.s3_url = "";
			draft.thumbnail_crop = article.thumbnail_crop;
			draft.image_data = article.content
				? extract_media_refs_from_content(article.content, ["image"]).map(
						(ref) => ref.data,
					)
				: [];
			draft.author_ids = article.draft_articles_to_authors.map(
				(a) => a.author_id,
			);

			return draft;
		});
	}

	useEffect(() => {
		const func = () => true;

		if (dirty) {
			addEventListener("beforeunload", func);
		} else {
			removeEventListener("beforeunload", func);
		}

		return () => {
			removeEventListener("beforeunload", func);
		};
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
				forceUpdate();

				// Undo/DragDrop need the editor's blocks painted in the DOM, which
				// isn't guaranteed yet when `onReady` fires — wait two paints instead
				// of guessing a fixed delay.
				requestAnimationFrame(() => {
					requestAnimationFrame(() => {
						// eslint-disable-next-line @typescript-eslint/no-unsafe-call
						new Undo({ editor: editorJS.current });
						// eslint-disable-next-line @typescript-eslint/no-unsafe-call
						new DragDrop(editorJS.current);
					});
				});

				async function update_article() {
					const editor_content = await editorJS.current?.save();
					if (!editor_content || !article) return;

					const updated = validate_article(editor_content, toaster);

					update_settings_from_editor({
						title: updated?.title ?? article.title,
						url: updated?.url ?? convert_title_to_url(article.title),
						// New (uuid) articles have no per-draft S3 directory — media is
						// decoupled (#18).
						s3_url: "",
						thumbnail_crop: article.thumbnail_crop,
						editor_content,
						article_id: article.id,
					});
				}

				void update_article();
			},
			onChange: (_, event) => {
				if (Array.isArray(event)) {
					for (const {} of event) {
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
