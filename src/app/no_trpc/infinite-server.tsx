"use server";

import { db } from "~/server/db";
import { withCursorPagination } from "drizzle-pagination";
import { asc } from "drizzle-orm";
import {
  PublishedArticle,
  PublishedArticlesToAuthors,
} from "~/server/db/schema";

export async function get_infinite_published(input: {
  limit: number;
  cursor?: string;
  direction?: "forward" | "backward";
}) {
  const direction = input.direction === "backward" ? "asc" : "desc";

  const data = await db.query.PublishedArticle.findMany({
    with: {
      published_articles_to_authors: {
        with: {
          author: true,
        },
        orderBy: asc(PublishedArticlesToAuthors.order),
      },
    },
    ...withCursorPagination({
      limit: input.limit,
      cursors: [[PublishedArticle.created_at, direction, input.cursor]],
    }),
  });

  const last = data.at(-1);

  return {
    data,
    next_cursor: last?.created_at,
  };
}
