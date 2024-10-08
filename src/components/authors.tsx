"use client";

import { Fragment, useMemo } from "react";
import { cached_state_store } from "~/app/provider";

export function Authors({ author_ids }: { author_ids: number[] }) {
  const all_authors = cached_state_store.get.all_authors();

  const authors = useMemo(
    () => all_authors.filter((author) => author_ids.includes(author.id)),
    [all_authors, author_ids],
  );
  // .sort((a, b) => author_ids.indexOf(a.id) - author_ids.indexOf(b.id)),

  return (
    <>
      {authors.map((author, index) => (
        // span className="flex-shrink-0"
        <Fragment key={author.id}>
          {author.name}
          {index !== authors.length - 1 && ",\u00A0"}
        </Fragment>
      ))}
    </>
  );
}
