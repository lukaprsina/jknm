import { Card, CardContent, CardFooter, CardHeader } from "~/components/ui/card";
import { format_date_for_human } from "~/lib/format-date";
import { get_archive_origin_label } from "~/server/article/lifecycle-rules";
import type { Article, ArticlesToAuthors, Author, Media } from "~/server/db/schema";
import { CreateSupersedingDraftButton } from "./create-superseding-draft-button";
import { DeleteArticleButton } from "./delete-article-button";

type ArchivedArticleRow = typeof Article.$inferSelect & {
	articles_to_authors: (typeof ArticlesToAuthors.$inferSelect & {
		author: typeof Author.$inferSelect;
	})[];
	thumbnail_media: typeof Media.$inferSelect | null;
};

export function ArchivedArticleCard({ article }: { article: ArchivedArticleRow }) {
	const origin = get_archive_origin_label({ published_at: article.published_at });

	return (
		<Card className="flex h-full flex-col">
			<CardHeader>
				<h3 className="line-clamp-2">{article.title}</h3>
			</CardHeader>
			<CardContent className="flex-1 text-sm text-muted-foreground">
				{origin}
				{article.archived_at && (
					<> · Arhivirana {format_date_for_human(article.archived_at)}</>
				)}
			</CardContent>
			<CardFooter className="flex justify-end gap-2">
				<CreateSupersedingDraftButton
					article_id={article.id}
					variant="ghost"
					size="sm"
					confirm={{
						title: "Obnovi iz arhiva",
						description:
							"Ustvarjen bo nov osnutek na podlagi arhivirane novičke, arhivirana novička pa bo izbrisana.",
					}}
				>
					Obnovi
				</CreateSupersedingDraftButton>
				<DeleteArticleButton article_id={article.id} variant="ghost" size="icon" />
			</CardFooter>
		</Card>
	);
}
