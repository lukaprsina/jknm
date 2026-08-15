import { unstable_cache } from "next/cache";
import type { CacheTag } from "~/lib/cache-policy";
import { PUBLIC_AUTHOR_COLUMNS } from "~/server/author/public-shape";
import { db } from "~/server/db";

export const cachedAllAuthors = unstable_cache(
	async () => {
		return db.query.Author.findMany({ columns: PUBLIC_AUTHOR_COLUMNS });
	},
	["authors"],
	{
		tags: ["authors"] satisfies CacheTag[],
		// Read on every page that renders bylines, and authors change rarely.
		revalidate: 3600,
	},
);
