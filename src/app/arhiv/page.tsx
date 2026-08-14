import type { Metadata } from "next";
import { Shell } from "~/components/shell";
import { page_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";
import { find_published_articles_year_range } from "~/server/article/article-queries";
import { getServerAuthSession } from "~/server/auth";
import { db } from "~/server/db";
import { Search } from "./search";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Arhiv novic",
	description:
		"Prebrskajte arhiv vseh objavljenih novic Jamarskega kluba Novo mesto.",
	alternates: { canonical: "/arhiv" },
};

export default async function Novice() {
	const [session, stats] = await Promise.all([
		getServerAuthSession(),
		find_published_articles_year_range(db),
	]);

	return (
		<Shell>
			<div className={cn(page_variants({ max_width: "wide" }))}>
				<div className="prose mb-7">
					<h1 className="mb-1">Arhiv novic</h1>
					{stats.min_year !== null && stats.max_year !== null && (
						<p className="not-prose text-sm text-muted-foreground">
							Novice od {stats.min_year} do {stats.max_year}
						</p>
					)}
				</div>
				<Search session={session} />
			</div>
		</Shell>
	);
}
