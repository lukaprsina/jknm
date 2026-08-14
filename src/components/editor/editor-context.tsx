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
import { useToast } from "~/hooks/use-toast";
import { convert_title_to_url } from "~/lib/article-utils";
import { extract_media_refs_from_content } from "~/lib/editor-utils";
import {
	DraftArticleContext,
	PublishedArticleContext,
} from "../article/context";
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
	const published = useContext(PublishedArticleContext);
	const [savingText, setSavingText] = useState<string | undefined>();
	const [editorInstance, setEditorInstance] = useState<EditorJS | null>(null);
	const editorJS = useRef<EditorJS | null>(null);
	const [dirty, setDirty] = useState(false);
	const toaster = useToast();

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
				setEditorInstance(editorJS.current);

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
					event.forEach(() => {
						onChange();
					});
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
				editor: editorInstance ?? undefined,
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
