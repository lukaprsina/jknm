import { unstable_cache } from "next/cache";
import { db } from "~/server/db";

export const cachedAllAuthors = unstable_cache(
	async () => {
		return db.query.Author.findMany();
	},
	["authors"],
	{ tags: ["authors"], revalidate: false },
);

/* export const cachedAllAuthors = memoize(
  async (author_type?: "member" | "guest") => {
    return author_type
      ? await db.query.Author.findMany({
          where: eq(Author.author_type, author_type),
        })
      : await db.query.Author.findMany();
  },
  {
    revalidateTags: (author_type) => ["authors", author_type ?? "is undefined"],
    // Enable logs to see timer or whether it triggers ODR or BR
    log: ["dedupe", "datacache", "verbose"],
    // Add custom string for logging
    logid: "authors",
  },
); */

/* const all_authors = api.author.get_all.useQuery(undefined, {
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  return all_authors.data; */
