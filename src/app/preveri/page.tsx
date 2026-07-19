import { memoize } from "nextjs-better-unstable-cache";
import { Shell } from "~/components/shell";
import { article_variants, page_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";
import { find_articles_for_verification } from "~/server/article/article-queries";
import { db } from "~/server/db";
import { PreveriClient } from "./preveri-client";

const cachedAllPublished = memoize(
	async () => {
		return find_articles_for_verification(db);
	},
	{
		revalidateTags: ["all-published"],
		logid: "all-published",
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
