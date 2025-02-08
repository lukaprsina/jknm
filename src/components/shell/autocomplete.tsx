"use client";

import type { AutocompleteSource } from "@algolia/autocomplete-js";
import type { Root } from "react-dom/client";
import React, { createElement, Fragment, useEffect, useRef } from "react";
import { autocomplete } from "@algolia/autocomplete-js";
import { createRoot } from "react-dom/client";

import "@algolia/autocomplete-theme-classic";

import "./autocomplete.css";

import type { PublishedArticleHit } from "~/lib/validators";
import type { StaticHit } from "./article-autocomplete";

interface AutocompleteProps {
  // detached?: string;
  openOnFocus: boolean;
  getSources: (props: {
    query: string;
  }) => [
    AutocompleteSource<StaticHit>,
    AutocompleteSource<PublishedArticleHit>,
  ];
}

// https://www.algolia.com/doc/ui-libraries/autocomplete/integrations/using-react/
export function Autocomplete({ ...props }: AutocompleteProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  const panelRootRef = useRef<Root | null>(null);

  useEffect(() => {
    console.log("Initializing autocomplete on", window.location.hostname);
    if (!containerRef.current) {
      console.error("Container not found");
      return;
    }

    const search_api = autocomplete({
      placeholder: "Išči …",
      container: containerRef.current,
      detachedMediaQuery: "(max-width: 1024px)",
      renderer: {
        createElement,
        Fragment,
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        render: () => {},
      },
      render({ children, elements, state }, root) {
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
      // ...props,
    });

    console.log("search_api", search_api);

    return () => {
      search_api.destroy();
    };
  }, []); // changed dependency array to run only once on mount

  return <div className="box-border flex-grow border-0" ref={containerRef} />;
}
