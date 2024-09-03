"use client";

import { Fragment, useMemo } from "react";
import { api } from "~/trpc/react";

export function Authors({ author_ids }: { author_ids: number[] }) {
  const all_authors = api.author.get_authors.useQuery();

  const authors = useMemo(
    () => all_authors.data?.filter((author) => author_ids.includes(author.id)),
    [all_authors, author_ids],
  );

  return (
    <>
      {authors?.map((author, index) => (
        // span className="flex-shrink-0"
        <Fragment key={author.id}>
          {author.name}
          {index !== authors.length - 1 && ",\u00A0"}
        </Fragment>
      ))}
    </>
  );
}
