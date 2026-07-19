import { unstable_cache } from "next/cache";
import { db } from "~/server/db";

export const cachedAllAuthors = unstable_cache(
	async () => {
		return db.query.Author.findMany();
	},
	["authors"],
	{ tags: ["authors"], revalidate: false },
);
