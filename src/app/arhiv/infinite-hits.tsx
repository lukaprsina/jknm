import type { InfiniteHitsProps } from "react-instantsearch";
import { ArticleAlgoliaCard } from "~/components/article/card";
import { useInfiniteAlgoliaArticles } from "~/hooks/use-infinite-algolia";
import { article_grid_variants, article_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";
import type { PublishedArticleHit } from "~/lib/validators";
import { MyStats } from "./components";

export function MyInfiniteHits(props: InfiniteHitsProps<PublishedArticleHit>) {
	const { load_more_ref, items } = useInfiniteAlgoliaArticles({
		offset: 9,
		...props,
	});

	return (
		<div>
			<MyStats loaded_count={items.length} />
			<ul
				className={cn(
					article_grid_variants(),
					article_variants({ variant: "card" }),
				)}
			>
				{items.map((hit, index) => (
					<ArticleAlgoliaCard
						hit={hit}
						key={hit.objectID}
						ref={load_more_ref(index)}
					/>
				))}
			</ul>
		</div>
	);
}
