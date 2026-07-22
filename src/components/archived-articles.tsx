import { desc, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { ArchivedArticleCard } from "~/components/article/archived-card";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "~/components/ui/accordion";
import type { CacheTag } from "~/lib/cache-policy";
import { article_grid_variants, article_variants } from "~/lib/page-variants";
import { revive_cache_dates } from "~/lib/revive-cache-dates";
import { db } from "~/server/db";
import { Article } from "~/server/db/schema";

export const cachedArchived = unstable_cache(
	async () => {
		return db.query.Article.findMany({
			where: eq(Article.status, "archived"),
			with: {
				articles_to_authors: { with: { author: true } },
				article_slugs: true,
				thumbnail_media: true,
			},
			orderBy: desc(Article.archived_at),
		});
	},
	["archive"],
	{
		tags: ["archive"] satisfies CacheTag[],
		// Editor-facing and low-traffic, so a short window costs little and
		// recovers quickly from a missed invalidation.
		revalidate: 300,
	},
);

export async function ArchivedArticles() {
	const archived = revive_cache_dates(await cachedArchived());

	let sklon: string | undefined;
	if (archived.length === 1) {
		sklon = "novička";
	} else if (archived.length === 2) {
		sklon = "novički";
	} else if (archived.length > 3 && archived.length <= 4) {
		sklon = "novičke";
	} else {
		sklon = "novičk";
	}

	return (
		<Accordion type="single" collapsible>
			<AccordionItem value="item-1">
				<AccordionTrigger>
					{archived.length !== 0 ? (
						<span>
							<b>Arhiv</b> ({archived.length} {sklon})
						</span>
					) : (
						<span>Arhiv je prazen</span>
					)}
				</AccordionTrigger>
				<AccordionContent className={article_variants({ variant: "card" })}>
					{archived.length !== 0 ? (
						<div className={article_grid_variants()}>
							{archived.map((article) => (
								<ArchivedArticleCard key={article.id} article={article} />
							))}
						</div>
					) : (
						<span>Arhiv je prazen</span>
					)}
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}
