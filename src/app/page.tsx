import {
	dehydrate,
	HydrationBoundary,
	QueryClient,
} from "@tanstack/react-query";
import type { Metadata } from "next";
import { ArchivedArticles } from "~/components/archived-articles";
import { DraftArticles } from "~/components/draft-articles";
import { Shell } from "~/components/shell";
import { CANONICAL_ORIGIN } from "~/lib/domains";
import { article_variants, page_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";
import { getServerAuthSession } from "~/server/auth";
import { InfiniteArticles } from "./infinite-articles";
import { publishedFeedQueryOptions } from "./published-feed-query";

export const metadata: Metadata = {
	alternates: { canonical: "/" },
};

const CLUB_NAME = "Jamarski klub Novo mesto";

/**
 * Static (no per-request data), so built once at module load rather than
 * per-request like `build_article_json_ld` — reinforces the club as a single
 * `Organization` entity for Google's knowledge-panel/entity understanding,
 * same rationale as the `Article` JSON-LD on `/novica/[slug]`.
 */
const ORGANIZATION_JSON_LD = JSON.stringify({
	"@context": "https://schema.org",
	"@graph": [
		{
			"@type": "Organization",
			"@id": `${CANONICAL_ORIGIN}/#organization`,
			name: CLUB_NAME,
			url: CANONICAL_ORIGIN,
			logo: `${CANONICAL_ORIGIN}/opengraph-image.png`,
		},
		{
			"@type": "WebSite",
			"@id": `${CANONICAL_ORIGIN}/#website`,
			url: CANONICAL_ORIGIN,
			name: CLUB_NAME,
			publisher: { "@id": `${CANONICAL_ORIGIN}/#organization` },
		},
	],
}).replace(/</g, "\\u003c");

function OrganizationJsonLd() {
	return (
		<script
			type="application/ld+json"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD has no other way to embed — content is a static, escaped constant.
			dangerouslySetInnerHTML={{ __html: ORGANIZATION_JSON_LD }}
		/>
	);
}

export default async function HomePageServer() {
	const queryClient = new QueryClient();

	const [session] = await Promise.all([
		getServerAuthSession(),
		queryClient.prefetchInfiniteQuery(publishedFeedQueryOptions()),
	]);

	return (
		<>
			<OrganizationJsonLd />
			<HydrationBoundary state={dehydrate(queryClient)}>
				<Shell without_footer>
					<div
						className={cn(
							page_variants({ max_width: "wide" }),
							!session && article_variants(),
						)}
					>
						{session && (
							<>
								<DraftArticles />
								<ArchivedArticles />
							</>
						)}
						<InfiniteArticles />
					</div>
				</Shell>
			</HydrationBoundary>
		</>
	);
}
