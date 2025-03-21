"use client";

import type {
  ClearRefinementsProps,
  UseRefinementListProps,
  UseSearchBoxProps,
} from "react-instantsearch";
import { XIcon } from "lucide-react";
import {
  useClearRefinements,
  useRefinementList,
  useSearchBox,
  useSortBy,
  useStats,
} from "react-instantsearch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "~/components/ui/select";
import type { RefinementListItem } from "instantsearch.js/es/connectors/refinement-list/connectRefinementList";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import React, { useCallback, useState } from "react";

export const DEFAULT_REFINEMENT = "published_article_created_at_desc";

/* 
TODO:
Warning: Can't perform a React state update on a component that hasn't mounted yet.
This indicates that you have a side-effect in your render function that asynchronously
later calls tries to update the component. Move this work to useEffect instead
 */
export function MySortBy() {
  const { currentRefinement, options, refine } = useSortBy({
    items: SORT_BY_ITEMS,
  });

  return (
    <div className="flex items-center justify-between gap-2">
      <p>Razvrsti po</p>
      <Select
        onValueChange={(value) => refine(value)}
        value={currentRefinement}
      >
        <SelectTrigger>
          <SelectValue placeholder="Sortiraj po ..." />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/* const queryHook: UseSearchBoxProps["queryHook"] = (query, search) => {
  search(query);
};

export function CustomSearchBox(props: UseSearchBoxProps) {
  const { query, refine } = useSearchBox(props);
  const { status } = useInstantSearch();
  const [inputValue, setInputValue] = useState(query);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isSearchStalled = status === "stalled";

  function setQuery(newQuery: string) {
    setInputValue(newQuery);

    refine(newQuery);
  }

  return (
    <div>
      <form
        action=""
        role="search"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();

          if (inputRef.current) {
            inputRef.current.blur();
          }
        }}
        onReset={(event) => {
          event.preventDefault();
          event.stopPropagation();

          setQuery("");

          if (inputRef.current) {
            inputRef.current.focus();
          }
        }}
      >
        <input
          ref={inputRef}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          placeholder="Search for products"
          spellCheck={false}
          maxLength={512}
          type="search"
          value={inputValue}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
          }}
          autoFocus
        />
        <button type="submit">Submit</button>
        <button
          type="reset"
          hidden={inputValue.length === 0 || isSearchStalled}
        >
          Reset
        </button>
        <span hidden={!isSearchStalled}>Searching…</span>
      </form>
    </div>
  );
} */

/* 
TODO:
Warning: Can't perform a React state update on a component that hasn't mounted yet.
This indicates that you have a side-effect in your render function that asynchronously
later calls tries to update the component. Move this work to useEffect instead
 */
export function MySearchBox2(props: UseSearchBoxProps) {
  const { query, refine: search_refine } = useSearchBox(props);
  const [inputValue, setInputValue] = useState(query);
  const { refine: sort_refine } = useSortBy({ items: SORT_BY_ITEMS });

  const setQuery = useCallback(
    (new_query: string) => {
      const trimmed = new_query.trim();

      if (trimmed === "") {
        sort_refine(DEFAULT_REFINEMENT);
      } else {
        sort_refine("published_article");
      }

      setInputValue(new_query);
      search_refine(new_query);
    },
    [search_refine, sort_refine],
  );

  return (
    <div className="flex w-full max-w-sm items-center space-x-2">
      <Input
        placeholder="Iskanje"
        value={inputValue}
        className="max-w-xl"
        onChange={(e) => {
          const text = e.target.value;

          setQuery(text);
        }}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        maxLength={512}
      />

      <Button
        variant="outline"
        size="icon"
        className="flex-shrink-0"
        onClick={() => {
          setQuery("");
        }}
      >
        <XIcon size={12} />
      </Button>
    </div>
  );
}

/* export function MySearchBox() {
  const search_api = useSearchBox({ queryHook });
  const { refine: sort_refine } = useSortBy({ items: SORT_BY_ITEMS });

  return (
    <div className="flex w-full max-w-sm items-center space-x-2">
      <Input
        placeholder="Išči po novicah …"
        value={search_api.query}
        className="max-w-xl"
        onChange={(e) => {
          const text = e.target.value;
          const trimmed = text.trim();

          search_api.refine(text);
          if (trimmed.length === 0) {
            sort_refine(DEFAULT_REFINEMENT);
          } else {
            sort_refine("published_article");
          }
        }}
      />

      <Button
        variant="outline"
        size="icon"
        onClick={() => {
          search_api.clear();
        }}
      >
        <XIcon size="12px" />
      </Button>
    </div>
  );
} */

export function MyStats() {
  const stats = useStats();

  return (
    <p>
      {stats.processingTimeMS} ms, {stats.nbHits} novic
    </p>
  );
}

export function TimelineRefinement(
  props: Omit<UseRefinementListProps, "attribute">,
) {
  const refinement_list = useRefinementList({
    attribute: "year",
    sortBy: ["name:asc"],
    limit: 100,
    ...props,
  });
  const clear_refinements = useClearRefinements({
    includedAttributes: ["year"],
  });

  /* const sorted_list = useMemo(() => {
    const sorted_items = refinement_list.items.sort((a, b) => {
      return parseInt(a.value) - parseInt(b.value);
    });

    console.log({ sorted_items });
    return sorted_items;
  }, [refinement_list]); */

  return (
    <ol className="space-t-4 flex flex-wrap items-center justify-start pb-2 pl-1">
      {refinement_list.items.map((item) => (
        <TimelineItem
          onClick={() => {
            if (item.isRefined) {
              clear_refinements.refine();
            } else {
              clear_refinements.refine();
              refinement_list.refine(item.value);
            }
          }}
          key={item.value}
          item={item}
        />
      ))}
    </ol>
  );
}

export function TimelineItem({
  item,
  ...props
}: { item: RefinementListItem } & React.ComponentProps<typeof Button>) {
  return (
    <li className="relative mb-6 pl-2 sm:mb-0">
      <Button
        variant="link"
        className={cn(
          "-ml-2 mb-0 mr-5 p-0 sm:pe-8",
          item.isRefined && "font-bold",
        )}
        style={{ paddingInlineEnd: "0px" }}
        {...props}
      >
        <span>{item.value}</span>
      </Button>
      <div className="flex items-center">
        {/* bg-blue-200 */}
        <div className="z-10 flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-muted-foreground ring-0 ring-background dark:bg-blue-900 dark:ring-background sm:ring-8">
          <button onClick={props.onClick}>
            <svg
              className="h-2.5 w-2.5"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              {/* <path d="M20 4a2 2 0 0 0-2-2h-2V1a1 1 0 0 0-2 0v1h-3V1a1 1 0 0 0-2 0v1H6V1a1 1 0 0 0-2 0v1H2a2 2 0 0 0-2 2v2h20V4ZM0 18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8H0v10Zm5-8h10a1 1 0 0 1 0 2H5a1 1 0 0 1 0-2Z" /> */}
            </svg>
          </button>
        </div>
        <div className="hidden h-0.5 w-full bg-gray-200 dark:bg-gray-700 sm:flex"></div>
      </div>
    </li>
  );
}

export function CustomClearRefinements(props: ClearRefinementsProps) {
  const { refine: clear_refinements } = useClearRefinements(props);
  const { clear: clear_search } = useSearchBox();
  const { refine: sort_refine } = useSortBy({ items: SORT_BY_ITEMS });

  return (
    <Button
      variant="outline"
      onClick={() => {
        clear_refinements();
        clear_search();
        sort_refine(DEFAULT_REFINEMENT);
      }}
    >
      Počisti filtre
    </Button>
  );
}

export const SORT_BY_ITEMS = [
  { value: "published_article_created_at_desc", label: "Najnovejše" },
  { value: "published_article_created_at_asc", label: "Najstarejše" },
  { value: "published_article_title_asc", label: "Ime naraščajoče" },
  { value: "published_article_title_desc", label: "Ime padajoče" },
  { value: "published_article_author_asc", label: "Avtor naraščajoče" },
  { value: "published_article_author_desc", label: "Avtor padajoče" },
];
