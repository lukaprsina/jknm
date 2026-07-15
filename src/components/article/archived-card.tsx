import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "~/components/ui/card";
import { format_date_for_human } from "~/lib/format-date";
import { get_archive_origin_badge } from "~/server/article/lifecycle-rules";
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
	const origin = get_archive_origin_badge({ published_at: article.published_at });

	return (
		<Card className="flex h-full flex-col">
			<CardHeader className="flex flex-row items-start justify-between gap-2">
				<h3 className="line-clamp-2">{article.title}</h3>
				<Badge variant="secondary" className="shrink-0">
					{origin}
				</Badge>
			</CardHeader>
			<CardContent className="flex-1 text-sm text-muted-foreground">
				{article.archived_at
					? `Arhivirana ${format_date_for_human(article.archived_at)}`
					: null}
			</CardContent>
			<CardFooter className="flex justify-end gap-2">
				<CreateSupersedingDraftButton
					article_id={article.id}
					variant="ghost"
					size="icon"
					confirm={{
						title: "Obnovi iz arhiva",
						description:
							"Ustvarjen bo nov osnutek na podlagi arhivirane novičke. Arhivirana novička ostane nespremenjena, dokler osnutka ne objavite.",
					}}
				>
					Obnovi
				</CreateSupersedingDraftButton>
				<DeleteArticleButton article_id={article.id} variant="ghost" size="icon" />
			</CardFooter>
		</Card>
	);
}
