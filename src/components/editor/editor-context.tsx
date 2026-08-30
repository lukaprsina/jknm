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
	useRef,
	useState,
} from "react";
import { resolve_default_published_at } from "~/components/article/new-adapter";
import { convert_title_to_url } from "~/lib/article-utils";
import { extract_media_refs_from_content } from "~/lib/editor-utils";
import type { ThumbnailType } from "~/lib/validators";
import {
	DraftArticleContext,
	PublishedArticleContext,
} from "../article/context";
import { commitEditorState, type EditorCommitResult } from "./editor-lib";
import { editor_store } from "./editor-store";
import { EDITOR_JS_PLUGINS } from "./plugins";

/**
 * "initializing" until EditorJS's `onReady` fires; consumers that need the
 * editor to be usable (toolbar buttons) gate on `"ready"` once, at the
 * toolbar root, rather than each re-deriving readiness themselves.
 */
export type EditorState = "initializing" | "ready";

export interface EditorContextType {
	state: EditorState;
	statusText: string | undefined;
	setStatusText: (value: string | undefined) => void;
	dirty: boolean;
	setDirty: (value: boolean) => void;
	commit: (overrides?: {
		published_at?: Date;
		thumbnail_crop?: ThumbnailType;
	}) => Promise<EditorCommitResult | undefined>;
}

export const EditorContext = createContext<EditorContextType | undefined>(
	undefined,
);

/**
 * Every consumer of `EditorContext` lives inside `EditorProvider` by
 * construction (`editor.tsx` wires the tree once) — this throws instead of
 * making every call site repeat an `if (!context) return null` guard against
 * a case that can't occur.
 */
export function useEditorContext(): EditorContextType {
	const context = useContext(EditorContext);
	if (!context) {
		throw new Error("useEditorContext must be used within an EditorProvider");
	}
	return context;
}

export function EditorProvider({ children }: { children: ReactNode }) {
	const article = useContext(DraftArticleContext);
	const published = useContext(PublishedArticleContext);
	const [statusText, setStatusText] = useState<string | undefined>();
	const [state, setState] = useState<EditorState>("initializing");
	const editorJS = useRef<EditorJS | null>(null);
	const [dirty, setDirty] = useState(false);

	const commit = useCallback(
		(overrides?: { published_at?: Date; thumbnail_crop?: ThumbnailType }) => {
			if (!article) return Promise.resolve(undefined);
			return commitEditorState({
				editor: editorJS.current ?? undefined,
				article,
				overrides,
			});
		},
		[article],
	);

	// Seeded synchronously during render (not in an effect/onReady) so the
	// toolbar and settings panel never paint a previous draft's state —
	// EditorJS's async `onReady` only needs to report content-derived fields.
	const [seededDraftId, setSeededDraftId] = useState<string | null>(null);
	if (article && seededDraftId !== article.id) {
		setSeededDraftId(article.id);

		editor_store.setState({
			draft_id: article.id,
			title: article.title,
			url: convert_title_to_url(article.title),
			s3_url: "",
			thumbnail_crop: article.thumbnail_crop,
			published_at: resolve_default_published_at(article, published),
			image_data: article.content
				? extract_media_refs_from_content(article.content, ["image"]).map(
						(ref) => ref.data,
					)
				: [],
			author_ids: article.draft_articles_to_authors.map((a) => a.author_id),
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
				setState("ready");

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

				// Surfaced even on initial load (not just user-triggered saves): an
				// article that's missing its heading is invalid whether the editor
				// just mounted or the user just clicked save.
				async function update_article() {
					const result = await commit();
					setStatusText(result?.error);
				}

				void update_article();
			},
			onChange: (_, event) => {
				if (Array.isArray(event)) {
					event.forEach(() => {
						onChange();
					});
				} else {
					onChange();
				}
			},
		});

		return temp_editor;
	}, [content, commit]);

	useEffect(() => {
		if (editorJS.current != null) return;

		const temp_editor = editor_factory();
		editorJS.current = temp_editor;
	}, [editor_factory]);

	return (
		<EditorContext.Provider
			value={{
				state,
				dirty,
				statusText,
				setStatusText,
				setDirty,
				commit,
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
