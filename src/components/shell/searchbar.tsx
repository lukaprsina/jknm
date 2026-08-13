"use client";

import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import type { SearchResponse } from "algoliasearch";
import { liteClient as algoliasearch } from "algoliasearch/lite";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "~/components/ui/command";
import { DialogDescription, DialogTitle } from "~/components/ui/dialog";
import { env } from "~/env";
import { ALGOLIA_PUBLISHED_ARTICLE_INDEX } from "~/lib/algoliasearch";
import type { PublishedArticleHit } from "~/lib/validators";
import { useSearchContext } from "./search-context";

const ALGOLIA_CLIENT = algoliasearch(
	env.NEXT_PUBLIC_ALGOLIA_ID,
	env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY,
);

export function Searchbar() {
	const { isSearchOpen, setSearchOpen } = useSearchContext();

	const [value, setValue] = useState("");
	const [noResults, setNoResults] = useState(false);

	const [contentPages, setContentPages] = useState<PublishedArticleHit[]>([]);
	const [publishedArticles, setPublishedArticles] = useState<
		PublishedArticleHit[]
	>([]);

	const [debounced_value] = useDebounce(value, 100, { maxWait: 1500 });

	const router = useRouter();

	useEffect(() => {
		if (!debounced_value || !isSearchOpen) return;

		const callback = async () => {
			// Both groups query the same index now — content-kind rows ("Vsebina")
			// and news rows ("Novice") are distinguished by an `article_kind` facet,
			// not by a separate `static_pages` index (ADR-0009). Deploy-order note:
			// `article_kind` must be declared as a filterable attribute on the
			// Algolia index (one-time manual dashboard step, ADR-0009) before this
			// ships, or Algolia rejects facetFilters and search breaks entirely.
			const { results } =
				await ALGOLIA_CLIENT.searchForHits<PublishedArticleHit>({
					requests: [
						{
							indexName: ALGOLIA_PUBLISHED_ARTICLE_INDEX,
							query: debounced_value,
							hitsPerPage: 3,
							facetFilters: ["article_kind:content"],
						},
						{
							indexName: ALGOLIA_PUBLISHED_ARTICLE_INDEX,
							query: debounced_value,
							hitsPerPage: 15,
							facetFilters: ["article_kind:article"],
						},
					],
					strategy: "none",
				});

			const content_pages = results[0] as SearchResponse<PublishedArticleHit>;
			const published_article =
				results[1] as SearchResponse<PublishedArticleHit>;

			setNoResults(
				content_pages.nbHits === 0 && published_article.nbHits === 0,
			);
			setContentPages(content_pages.hits);
			setPublishedArticles(published_article.hits);
		};

		void callback();
	}, [debounced_value, isSearchOpen]);

	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				setSearchOpen(!isSearchOpen);
			}
		};
		document.addEventListener("keydown", down);
		return () => document.removeEventListener("keydown", down);
	}, [isSearchOpen, setSearchOpen]);

	return (
		<CommandDialog
			commandProps={{ shouldFilter: false }}
			open={isSearchOpen}
			onOpenChange={setSearchOpen}
		>
			<VisuallyHidden>
				<DialogTitle>Command Menu</DialogTitle>
				<DialogDescription>
					Search for commands and resources.
				</DialogDescription>
			</VisuallyHidden>
			<CommandInput
				value={value}
				onValueChange={(new_value) => setValue(new_value)}
				placeholder="Iskanje"
			/>
			<CommandList>
				{noResults && <CommandEmpty>Ni rezultatov</CommandEmpty>}
				{value && (
					<>
						<CommandGroup heading="Vsebina">
							{contentPages.map((item) => (
								<CommandItem
									key={item.url}
									onSelect={() => router.push(`/${item.url}`)}
								>
									{item.title}
								</CommandItem>
							))}
						</CommandGroup>
						<CommandGroup heading="Novice">
							{publishedArticles.map((item) => (
								<CommandItem
									key={item.url}
									onSelect={() => router.push(`/novica/${item.url}`)}
								>
									{item.title}
								</CommandItem>
							))}
						</CommandGroup>
					</>
				)}
			</CommandList>
		</CommandDialog>
	);
}
