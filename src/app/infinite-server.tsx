"use server";

import { db } from "~/server/db";
import { withCursorPagination } from "drizzle-pagination";
import { asc } from "drizzle-orm";
import {
  PublishedArticle,
  PublishedArticlesToAuthors,
} from "~/server/db/schema";

export async function get_infinite_published2({
  pageParam,
  limit,
}: {
  pageParam: Date | undefined;
  limit: number;
}) {
  const direction = "desc";
  const cursor = pageParam;

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
      limit,
      cursors: [[PublishedArticle.created_at, direction, cursor]],
    }),
  });

  return {
    data,
    next_cursor: data.at(-1)?.created_at,
    // prev_cursor: data.at(0)?.created_at,
  };
}
