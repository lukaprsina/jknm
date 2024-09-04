"use client";

import type {
  AutocompleteComponents,
  AutocompleteSource,
} from "@algolia/autocomplete-js";
import type { Root } from "react-dom/client";
import React, {
  createElement,
  Fragment,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { autocomplete, getAlgoliaResults } from "@algolia/autocomplete-js";
import { createRoot } from "react-dom/client";

import { algolia } from "~/lib/algolia";

import "@algolia/autocomplete-theme-classic";

import Link from "next/link";

import "./autocomplete.css";

import { PoweredBy } from "react-instantsearch";
import { Separator } from "~/components/ui/separator";
import type { ArticleHit } from "~/lib/validators";

export function NoviceAutocomplete({ detached }: { detached?: string }) {
  const searchClient = algolia.getClient();

  return (
    <Autocomplete
      detached={detached}
      openOnFocus
      getSources={({ query }) => [
        {
          sourceId: "novice",
          getItemUrl: ({ item }) => {
            return `/novica/${item.url}`;
          },
          getItems() {
            return getAlgoliaResults({
              searchClient,
              queries: [
                {
                  indexName: "novice",
                  query,
                  params: {
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
              return <ProductItem hit={item} components={components} />;
            },
            footer() {
              return (
                <div className="w-full">
                  <Separator className="w-full" />
                  <div className="flex items-center justify-between px-6 py-8">
                    <Link href="/novice">Vse novice</Link>
                    <PoweredBy className="w-40" />
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

interface AutocompleteProps {
  detached?: string;
  openOnFocus: boolean;
  getSources: (props: { query: string }) => AutocompleteSource<ArticleHit>[];
}

// https://www.algolia.com/doc/ui-libraries/autocomplete/integrations/using-react/
export function Autocomplete({ detached, ...props }: AutocompleteProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  const panelRootRef = useRef<Root | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const search_api = autocomplete({
      container: containerRef.current,
      detachedMediaQuery: detached ?? "(max-width: 1024px)",
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      renderer: { createElement, Fragment, render: () => {} },
      render({ children }, root) {
        if (!panelRootRef.current || rootRef.current !== root) {
          rootRef.current = root;

          panelRootRef.current?.unmount();
          panelRootRef.current = createRoot(root);
        }

        panelRootRef.current.render(children);
      },

      navigator: {
        navigate({ itemUrl }) {
          console.log("navigate", itemUrl);
          window.location.assign(itemUrl);
        },
        navigateNewTab({ itemUrl }) {
          console.log("navigate new tab", itemUrl);
          const windowReference = window.open(itemUrl, "_blank", "noopener");

          if (windowReference) {
            windowReference.focus();
          }
        },
        navigateNewWindow({ itemUrl }) {
          console.log("navigate new window", itemUrl);
          window.open(itemUrl, "_blank", "noopener");
        },
      },
      ...props,
    });

    return () => {
      search_api.destroy();
    };
  }, [detached, props]);

  return <div className="box-border flex-grow border-0" ref={containerRef} />;
}

interface ProductItemProps {
  hit: ArticleHit;
  components: AutocompleteComponents;
}

function ProductItem({ hit, components }: ProductItemProps) {
  const href = useMemo(() => `/novica/${hit.url}`, [hit]);

  return (
    <Link href={href} className="aa-ItemLink text-inherit">
      <div className="aa-ItemContent h-12 overflow-hidden">
        {/* {hit.image && (
          <div className="aa-ItemIcon aa-ItemIcon--noBorder">
            <img src={hit.image}/>
          </div>
        )} */}
        <div className="aa-ItemContentBody">
          <div className="aa-ItemContentTitle">
            <components.Highlight hit={hit} attribute="title" />
          </div>
          <div className="aa-ItemContentDescription">
            {/* <components.Snippet hit={hit} attribute="content" /> */}
          </div>
        </div>
      </div>
    </Link>
  );
}
