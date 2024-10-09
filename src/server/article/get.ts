export const publish_validator = z.object({
    article: PublishArticleSchema,
    author_ids: z.array(z.number()),
    draft_id: z.number().optional(),
  });
  
  export async function publish(input: z.infer<typeof publish_validator>) {
    const validated_input = publish_validator.safeParse(input);
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

      const published = await ctx.db.query.PublishedArticle.findFirst({
        where: and(...conditions),
        with: {
          published_articles_to_authors: {
            with: { author: true },
            orderBy: asc(PublishedArticlesToAuthors.order),
          },
        },
      });

      /* console.log("get_article_by_published_url published", {
        published,
        conditions,
      }); */
      // only send draft when logged in
      if (ctx.session && published?.id) {
        const draft = await ctx.db.query.DraftArticle.findFirst({
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