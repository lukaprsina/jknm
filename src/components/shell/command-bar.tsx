import { liteClient as algoliasearch } from "algoliasearch/lite";
import {
  type AutocompleteState,
  createAutocomplete,
} from "@algolia/autocomplete-core";
import { getAlgoliaResults } from "@algolia/autocomplete-preset-algolia";
import { useState, useMemo, useRef, useCallback } from "react";
import { env } from "~/env";
import "@algolia/autocomplete-theme-classic";
import "./autocomplete.css";

const ALGOLIA_CLIENT = algoliasearch(
  env.NEXT_PUBLIC_ALGOLIA_ID,
  env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY,
);

export type StaticHit = {
  objectID: string;
  text: string;
};

export function CommandBar() {
  const [autocompleteState, setAutocompleteState] =
    useState<AutocompleteState<StaticHit> | null>();
  const input_element = useRef<HTMLInputElement | null>(null);

  const autocomplete = useMemo(
    () =>
      createAutocomplete<StaticHit>({
        openOnFocus: true,
        onStateChange({ state }) {
          setAutocompleteState(state);
        },
        getSources() {
          return [
            {
              sourceId: "static_pages",
              getItemInputValue({ item }) {
                return item.text;
              },
              getItems({ query }) {
                return getAlgoliaResults({
                  searchClient: ALGOLIA_CLIENT,
                  queries: [
                    {
                      indexName: "static_pages",
                      params: {
                        query,
                        hitsPerPage: 4,
                        highlightPreTag: "<mark>",
                        highlightPostTag: "</mark>",
                      },
                    },
                  ],
                });
              },
              getItemUrl({ item }) {
                return item.objectID;
              },
            },
          ];
        },
      }),
    [],
  );

  const input_props = useCallback(() => {
    return autocomplete.getInputProps({
      inputElement: input_element.current,
    });
  }, [autocomplete, input_element]);

  const panel_props = useCallback(() => {
    return autocomplete.getPanelProps({});
  }, [autocomplete]);

  return (
    <div className="aa-Autocomplete" {...autocomplete.getRootProps()}>
      <input ref={input_element} className="aa-Input" {...input_props()} />
      <div className="aa-Panel" {...panel_props()}>
        {autocompleteState?.isOpen &&
          autocompleteState.collections.map((collection, index) => {
            const { source, items } = collection;

            return (
              <div key={`source-${index}`} className="aa-Source">
                {items.length > 0 && (
                  <ul className="aa-List" {...autocomplete.getListProps()}>
                    {items.map((item) => (
                      <li
                        key={item.objectID}
                        className="aa-Item"
                        {...autocomplete.getItemProps({
                          item,
                          source,
                        })}
                      >
                        {item.objectID}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
