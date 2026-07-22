"use client";

import "./editor.css";

import {
	DraftArticleContext,
	PublishedArticleContext,
} from "~/components/article/context";
import type {
	EditorDraftArticle,
	PublishedArticleView,
} from "~/components/article/new-adapter";
import { EditorProvider } from "~/components/editor/editor-context";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { article_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";
import { MyToolbar } from "./toolbar";

export default function MyEditor({
	draft,
	published,
}: {
	draft: EditorDraftArticle;
	published?: PublishedArticleView;
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
							<CardContent className="prose prose-h1:mb-6! prose-img:my-0!">
								<div id="editorjs" />
							</CardContent>
						</Card>
					</div>
				</EditorProvider>
			</PublishedArticleContext.Provider>
		</DraftArticleContext.Provider>
	);
}
