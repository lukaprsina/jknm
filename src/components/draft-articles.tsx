import { memoize } from "nextjs-better-unstable-cache";
import { NewDraftArticleCard } from "~/components/article/new-card";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "~/components/ui/accordion";
import { article_grid_variants, article_variants } from "~/lib/page-variants";
import { find_draft_articles } from "~/server/article/article-queries";
import { db } from "~/server/db";

export const cachedDrafts = memoize(
	async () => {
		return find_draft_articles(db);
	},
	{
		revalidateTags: ["drafts"],
		logid: "drafts",
	},
);

export async function DraftArticles() {
	const drafts = await cachedDrafts();

	let sklon: string | undefined;
	if (drafts.length === 1) {
		sklon = "osnutek";
	} else if (drafts.length === 2) {
		sklon = "osnutka";
	} else if (drafts.length > 3 && drafts.length <= 4) {
		sklon = "osnutki";
	} else {
		sklon = "osnutkov";
	}

	return (
		<Accordion type="single" collapsible>
			<AccordionItem value="item-1">
				<AccordionTrigger>
					{drafts.length !== 0 ? (
						<span>
							<b>Osnutki</b> ({drafts.length} {sklon})
						</span>
					) : (
						<span>Ni osnutkov</span>
					)}
				</AccordionTrigger>
				<AccordionContent className={article_variants({ variant: "card" })}>
					{drafts.length !== 0 ? (
						<div className={article_grid_variants()}>
							{drafts.map((article) => (
								<NewDraftArticleCard key={article.id} article={article} />
							))}
						</div>
					) : (
						<span>Ni osnutkov</span>
					)}
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}
