import { DialogTitle, DialogDescription } from "~/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "~/components/ui/command";
import { useState, useEffect } from "react";
import { env } from "~/env";
import { liteClient as algoliasearch } from "algoliasearch/lite";
import { type PublishedArticleHit } from "~/lib/validators";
import { type SearchResponse } from "algoliasearch";
import { useDebounce } from "use-debounce";
import Link from "next/link";
import { useSearchContext } from "./search-context";

const ALGOLIA_CLIENT = algoliasearch(
  env.NEXT_PUBLIC_ALGOLIA_ID,
  env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY,
);

export type StaticHit = {
  objectID: string;
  text: string;
  index: number;
  section: string;
};

export function CommandMenu() {
  const { isSearchOpen, setSearchOpen } = useSearchContext();

  const [value, setValue] = useState("");
  const [noResults, setNoResults] = useState(false);

  const [staticPages, setStaticPages] = useState<StaticHit[]>([]);
  const [publishedArticles, setPublishedArticles] = useState<
    PublishedArticleHit[]
  >([]);

  const [debounced_value] = useDebounce(value, 100, { maxWait: 1500 });

  useEffect(() => {
    if (!debounced_value || !isSearchOpen) return;

    const callback = async () => {
      const { results } = await ALGOLIA_CLIENT.searchForHits<
        StaticHit | PublishedArticleHit
      >({
        requests: [
          {
            indexName: "static_pages",
            query: debounced_value,
            hitsPerPage: 3,
          },
          {
            indexName: "published_article",
            query: debounced_value,
            hitsPerPage: 15,
          },
        ],
        strategy: "none",
      });

      console.log("ALGOLIA RESULT", results);
      const static_pages = results[0] as SearchResponse<StaticHit>;
      const published_article =
        results[1] as SearchResponse<PublishedArticleHit>;

      setNoResults(static_pages.nbHits == 0 && published_article.nbHits == 0);
      setStaticPages(static_pages.hits);
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
        placeholder="Išči..."
      />
      <CommandList>
        {noResults && <CommandEmpty>Ni rezultatov</CommandEmpty>}
        {value && (
          <>
            <CommandGroup heading="Stran">
              {staticPages.map((item, idx) => (
                <CommandItem
                  asChild
                  key={idx}
                  onSelect={(value) => console.log("Stran Selected", value)}
                >
                  <Link href={`/${item.section}`}>
                    {item.section.charAt(0).toUpperCase() +
                      item.section.slice(1)}
                  </Link>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Novice">
              {publishedArticles.map((item, idx) => (
                <CommandItem
                  asChild
                  key={idx}
                  onSelect={(value) => console.log("Novice Selected", value)}
                >
                  <Link href={`/novica/${item.url}`}>{item.title}</Link>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
