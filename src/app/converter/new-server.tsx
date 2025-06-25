"use server";

import { eq, sql } from "drizzle-orm";
import { db } from "~/server/db";
import { PublishedArticle } from "~/server/db/schema";

export async function get_article_by_id(dbId: number) {
    const article = await db.query.PublishedArticle.findFirst({
        where: eq(PublishedArticle.id, dbId),
    })

    return article
}

export async function get_embeds() {
    // This query finds articles where at least one block has type 'embed'
    const embeds = await db.query.PublishedArticle.findMany({
        where: sql`EXISTS (
            SELECT 1 FROM jsonb_array_elements(${PublishedArticle.content}::jsonb->'blocks') AS block
            WHERE block->>'type' = 'embed'
        )`
    });
    console.log("Embeds in DB:", embeds.length, embeds.map(e => ({
        id: e.id,
        title: e.title,
    })).sort((a, b) => a.id - b.id));
    return embeds;
}