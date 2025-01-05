import {
  type AutocompleteComponents,
  getAlgoliaResults,
} from "@algolia/autocomplete-js";

import "@algolia/autocomplete-theme-classic";

import Link from "next/link";

import "./autocomplete.css";

import { PoweredBy } from "react-instantsearch";
import { Separator } from "~/components/ui/separator";
import { get_published_article_link } from "~/lib/article-utils";
import { liteClient as algoliasearch } from "algoliasearch/lite";
import { env } from "~/env";
import { article_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";
import { Autocomplete } from "./autocomplete";
import { use, useMemo } from "react";
import { DuplicateURLsContext } from "~/app/provider";
import { type PublishedArticleHit } from "~/lib/validators";

const searchClient = algoliasearch(
  env.NEXT_PUBLIC_ALGOLIA_ID,
  env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY,
);

export function ArticleAutocomplete() {
  const duplicate_urls: string[] = [];

  return (
    <Autocomplete
      openOnFocus={true}
      getSources={({ query }) => [
        {
          sourceId: "static_pages",
          getItemUrl: ({ item }) => {
            return `/strani/${item.objectID}`;
          },
          getItems() {
            return getAlgoliaResults({
              searchClient,
              queries: [
                {
                  indexName: "static_pages",
                  params: {
                    query,
                    hitsPerPage: 2,
                  },
                },
              ],
            });
          },
          templates: {
            header() {
              return (
                <>
                  <span className="aa-SourceHeaderTitle">Besedilo</span>
                  <div className="aa-SourceHeaderLine" />
                </>
              );
            },
            item({ item, components }) {
              return (
                <ArticleAutocompleteStaticItem
                  hit={item}
                  components={components}
                />
              );
            },
            /* footer() {
              return (
                <div className="w-full">
                  <Separator className="w-full" />
                  <div
                    className={cn(
                      "flex flex-wrap items-center justify-center gap-2 pb-6 pt-8",
                      article_variants(),
                      // "flex items-end justify-between px-6 py-8",
                    )}
                  >
                    <Link href="/arhiv">Arhiv novic</Link>
                    <PoweredBy className="w-32" />
                  </div>
                </div>
              );
            },
            noResults() {
              return "Ni ujemajočih novic.";
            }, */
          },
        },
        {
          sourceId: "published_article",
          getItemUrl: ({ item }) => {
            return get_published_article_link(
              item.url,
              item.created_at,
              duplicate_urls,
            );
          },
          getItems() {
            return getAlgoliaResults({
              searchClient,
              queries: [
                {
                  indexName: "published_article",
                  params: {
                    query,
                    hitsPerPage: 8,
                  },
                },
              ],
            });
          },
          templates: {
            header() {
              return (
                <>
                  <span className="aa-SourceHeaderTitle">Novice</span>
                  <div className="aa-SourceHeaderLine" />
                </>
              );
            },
            item({ item, components }) {
              return (
                <ArticleAutocompleteItem hit={item} components={components} />
              );
            },
            footer() {
              return (
                <div className="w-full">
                  <Separator className="w-full" />
                  <div
                    className={cn(
                      "flex flex-wrap items-center justify-center gap-2 pb-6 pt-8",
                      article_variants(),
                      // "flex items-end justify-between px-6 py-8",
                    )}
                  >
                    <Link href="/arhiv">Arhiv novic</Link>
                    <PoweredBy className="w-32" />
                  </div>
                </div>
              );
            },
            noResults() {
              return "Ni ujemajočih novic.";
            },
          },
        },
      ]}
    />
  );
}

export type StaticHit = {
  objectID: string;
  text: string;
};

interface ArticleAutocompleteStaticItemProps {
  hit: StaticHit;
  components: AutocompleteComponents;
}

function ArticleAutocompleteStaticItem({
  hit,
  //   components,
}: ArticleAutocompleteStaticItemProps) {
  return <p>{hit.text}</p>;
  /* const duplicate_urls = use(DuplicateURLsContext);

  const href = useMemo(
    () => get_published_article_link(hit.url, hit.created_at, duplicate_urls),
    [duplicate_urls, hit.created_at, hit.url],
  );

  return (
    <Link href={href} className="aa-ItemLink text-inherit">
      <div className="aa-ItemContent h-12 overflow-hidden">
        <div className="aa-ItemContentBody">
          <div className="aa-ItemContentTitle">
            <components.Highlight hit={hit} attribute="title" />
          </div>
          <div className="aa-ItemContentDescription" />
        </div>
      </div>
    </Link>
  ); */
}

interface ArticleAutocompleteItemProps {
  hit: PublishedArticleHit;
  components: AutocompleteComponents;
}

function ArticleAutocompleteItem({
  hit,
  components,
}: ArticleAutocompleteItemProps) {
  const duplicate_urls = use(DuplicateURLsContext);

  const href = useMemo(
    () => get_published_article_link(hit.url, hit.created_at, duplicate_urls),
    [duplicate_urls, hit.created_at, hit.url],
  );

  return (
    <Link href={href} className="aa-ItemLink text-inherit">
      <div className="aa-ItemContent h-12 overflow-hidden">
        <div className="aa-ItemContentBody">
          <div className="aa-ItemContentTitle">
            <components.Highlight hit={hit} attribute="title" />
          </div>
          <div className="aa-ItemContentDescription" />
        </div>
      </div>
    </Link>
  );
}
