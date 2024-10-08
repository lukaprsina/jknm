"use client";

import { Fragment, use, useMemo } from "react";
import { cachedAllAuthors } from "~/server/api/authors/get-all-authors";

export function Authors({ author_ids }: { author_ids: number[] }) {
  const all_authors = [];

  const authors = useMemo(
    () =>
      all_authors
        .filter((author) => author_ids.includes(author.id))
        .sort((a, b) => author_ids.indexOf(a.id) - author_ids.indexOf(b.id)),
    [all_authors, author_ids],
  );

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
