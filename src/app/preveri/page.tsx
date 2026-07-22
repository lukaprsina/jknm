import { unstable_cache } from "next/cache";
import { Shell } from "~/components/shell";
import type { CacheTag } from "~/lib/cache-policy";
import { article_variants, page_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";
import { find_articles_for_verification } from "~/server/article/article-queries";
import { db } from "~/server/db";
import { PreveriClient } from "./preveri-client";

const cachedAllPublished = unstable_cache(
	async () => {
		return find_articles_for_verification(db);
	},
	["all-published"],
	{
		tags: ["all-published"] satisfies CacheTag[],
		// Verification view: its whole job is reflecting reality, and it is read
		// by admins only, so bound it tightly.
		revalidate: 300,
	},
);

export default async function PreveriPage() {
	const articles = await cachedAllPublished();

	return (
		<Shell without_footer>
			<div
				className={cn(page_variants(), article_variants(), "max-w-none px-6")}
			>
				<PreveriClient articles={articles} />
			</div>
		</Shell>
	);
}
