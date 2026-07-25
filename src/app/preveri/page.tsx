import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Shell } from "~/components/shell";
import type { CacheTag } from "~/lib/cache-policy";
import { article_variants, page_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";
import { find_articles_for_verification } from "~/server/article/article-queries";
import { getServerAuthSession } from "~/server/auth";
import { db } from "~/server/db";
import { PreveriClient } from "./preveri-client";

export const metadata: Metadata = {
	title: "Preveri",
	robots: { index: false, follow: false },
};

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
	const session = await getServerAuthSession();
	if (!session) notFound();

	const articles = await cachedAllPublished();

	return (
		<Shell without_footer>
			<div
				className={cn(page_variants(), article_variants(), "max-w-none px-6")}
			>
				<Suspense fallback={null}>
					<PreveriClient articles={articles} />
				</Suspense>
			</div>
		</Shell>
	);
}
