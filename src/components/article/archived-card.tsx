import Link from "next/link";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
} from "~/components/ui/card";
import { format_date_for_human } from "~/lib/format-date";
import type {
	Article,
	ArticleSlug,
	ArticlesToAuthors,
	Author,
	Media,
} from "~/server/db/schema";
import { CreateSupersedingDraftButton } from "./create-superseding-draft-button";
import { DeleteArticleButton } from "./delete-article-button";
import { get_primary_slug } from "./new-adapter";

type ArchivedArticleRow = typeof Article.$inferSelect & {
	articles_to_authors: (typeof ArticlesToAuthors.$inferSelect & {
		author: typeof Author.$inferSelect;
	})[];
	article_slugs: (typeof ArticleSlug.$inferSelect)[];
	thumbnail_media: typeof Media.$inferSelect | null;
};

export function ArchivedArticleCard({
	article,
}: {
	article: ArchivedArticleRow;
}) {
	// Admins can still reach an archived article's public URL directly
	// (`is_visible_to` allows it); one that was archived straight from a
	// draft never had a slug minted, so there's nothing to link to.
	const slug = get_primary_slug(article);

	return (
		<Card className="flex h-full flex-col">
			<CardHeader>
				{slug ? (
					<Link
						href={`/novica/${encodeURIComponent(slug)}`}
						className="hover:underline"
					>
						<h3 className="line-clamp-2">{article.title}</h3>
					</Link>
				) : (
					<h3 className="line-clamp-2">{article.title}</h3>
				)}
			</CardHeader>
			<CardContent className="flex-1 text-sm text-muted-foreground">
				{article.archived_at && (
					<>Arhivirana {format_date_for_human(article.archived_at)}</>
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
				<DeleteArticleButton
					article_id={article.id}
					variant="ghost"
					size="icon"
				/>
			</CardFooter>
		</Card>
	);
}
