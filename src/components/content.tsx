import type { PublishedArticleView } from "~/components/article/new-adapter";
import { ArticleNotFound } from "~/components/component-not-found";
import { EditorToReact } from "~/components/editor/editor-to-react";
import { article_variants, page_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";

export function PublishedContent({
	article,
}: {
	article?: PublishedArticleView;
}) {
	if (!article?.content) {
		return <ArticleNotFound />;
	}

	return (
		<div className={cn(article_variants(), page_variants())}>
			<EditorToReact article={article} />
		</div>
	);
}
