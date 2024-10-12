"use server";

import type { z } from "zod";
import {
  DraftArticle,
  PublishedArticle,
  PublishedArticlesToAuthors,
} from "../db/schema";
import {
  get_article_by_published_url_validator,
  get_article_by_published_id_validator,
  get_article_by_draft_id_validator,
} from "./validators";
import { eq, between, and, asc } from "drizzle-orm";
import { db } from "../db";
import { getServerAuthSession } from "../auth";

export async function get_article_by_published_id(
  input: z.infer<typeof get_article_by_published_id_validator>,
) {
  const validated_input =
    get_article_by_published_id_validator.safeParse(input);
  if (!validated_input.success) {
    throw new Error(validated_input.error.message);
  }

  const published = await db.query.PublishedArticle.findFirst({
    where: eq(PublishedArticle.id, input.published_id),
    with: {
      published_articles_to_authors: {
        with: { author: true },
        orderBy: asc(PublishedArticlesToAuthors.order),
      },
    },
  });

  if (!published) return { published };

  const session = await getServerAuthSession();
  if (session) {
    const draft = await db.query.DraftArticle.findFirst({
      where: eq(DraftArticle.published_id, input.published_id),
      with: {
        draft_articles_to_authors: {
          with: { author: true },
          orderBy: asc(PublishedArticlesToAuthors.order),
        },
      },
    });

    return { published, draft };
  }

  return { published };
}

export async function get_article_by_published_url(
  input: z.infer<typeof get_article_by_published_url_validator>,
) {
  const validated_input =
    get_article_by_published_url_validator.safeParse(input);
  if (!validated_input.success) {
    throw new Error(validated_input.error.message);
  }

  const conditions = [eq(PublishedArticle.url, input.url)];

  if (input.created_at) {
    const beggining_of_day = new Date(input.created_at);
    beggining_of_day.setHours(0, 0, 0, 0);
    const end_of_day = new Date(input.created_at);
    end_of_day.setHours(23, 59, 59, 999);

    conditions.push(
      between(PublishedArticle.created_at, beggining_of_day, end_of_day),
    );
  }

  const published = await db.query.PublishedArticle.findFirst({
    where: and(...conditions),
    with: {
      published_articles_to_authors: {
        with: { author: true },
        orderBy: asc(PublishedArticlesToAuthors.order),
      },
    },
  });

  // only send draft when logged in
  const session = await getServerAuthSession();
  if (session && published?.id) {
    const draft = await db.query.DraftArticle.findFirst({
      where: eq(DraftArticle.published_id, published.id),
      with: {
        draft_articles_to_authors: {
          with: {
            author: true,
          },
          orderBy: asc(PublishedArticlesToAuthors.order),
        },
      },
    });

    return { published, draft };
  }

  return { published };
}

export async function get_article_by_draft_id(
  input: z.infer<typeof get_article_by_draft_id_validator>,
) {
  const validated_input = get_article_by_draft_id_validator.safeParse(input);
  if (!validated_input.success) {
    throw new Error(validated_input.error.message);
  }
  const draft = await db.query.DraftArticle.findFirst({
    where: eq(DraftArticle.id, input.draft_id),
    with: {
      draft_articles_to_authors: {
        with: {
          author: true,
        },
        orderBy: asc(PublishedArticlesToAuthors.order),
      },
    },
  });

  if (draft?.published_id) {
    const published = await db.query.PublishedArticle.findFirst({
      where: eq(PublishedArticle.id, draft.published_id),
      with: {
        published_articles_to_authors: {
          with: {
            author: true,
          },
          orderBy: asc(PublishedArticlesToAuthors.order),
        },
      },
    });

    return { draft, published };
  }

  return { draft };
}
