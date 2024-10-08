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
}: {
  pageParam: number | null;
}) {
  const direction = "desc";
  const cursor = pageParam ? new Date(pageParam) : new Date();

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
      limit: 31,
      cursors: [[PublishedArticle.created_at, direction, cursor]],
    }),
  });

  const last = data.at(-1);

  return {
    data,
    next_cursor: last?.created_at,
  };
}
