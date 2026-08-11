/**
 * Prod promotion, publish step (#39): flips one of the 5 migrated content-kind
 * drafts (see `migrate-static-page.ts` / `vsebina-postpass.ts`) to `published`
 * by calling `publish_article` directly, the same way `create-draft.ts`
 * bypasses the oRPC action -- `publish_article` itself takes no session (auth
 * lives in the oRPC wrapper, see `src/server/orpc/article/procedures.ts`), so
 * it's safely callable from a script. No dry-run: publishing is inherently a
 * one-shot real action, same as `create-draft.ts`.
 *
 * Content pages have no byline, so `author_ids` is always empty. `content` is
 * omitted from the payload so `publish_article` keeps the draft's persisted
 * `content_json` unchanged (see its doc comment).
 *
 * Usage:
 *   dotenv -e .env.local -- bun run scripts/migrate/publish-content-page.ts zgodovina
 */

import { eq } from "drizzle-orm";
import { env } from "~/env";
import { get_base_url } from "~/lib/get-base-url";
import { find_article_with_relations } from "~/server/article/article-queries";
import { find_primary_slug_or_first } from "~/server/article/lifecycle-rules";
import { publish_article } from "~/server/article/new-article";
import { db } from "~/server/db";
import { Article } from "~/server/db/schema";
import { find_existing_content_draft } from "./create-draft";
import { is_static_page_slug, STATIC_PAGES } from "./pages";

const UPDATE_TAG_OUTSIDE_ACTION_MESSAGE =
	"updateTag can only be called from within a Server Action";

/**
 * Asks the *live* server process to bust its own cache via
 * `/api/internal/revalidate` -- this script's own process can never do it
 * directly (`updateTag` requires a Server Action, which a standalone script
 * is never running inside). Best-effort: the live server's `revalidate:
 * 3600` TTL is a real fallback, just a slow one, so a failure here is logged
 * and doesn't fail the publish.
 */
async function notify_live_server(): Promise<void> {
	const base_url = get_base_url(true);

	const response = await fetch(`${base_url}/api/internal/revalidate`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-revalidate-secret": env.REVALIDATE_SECRET,
		},
		body: JSON.stringify({ event: "article.published" }),
	}).catch((error: unknown) => {
		console.warn(`Revalidate request to ${base_url} failed:`, error);
		return undefined;
	});

	if (response?.ok === false) {
		console.warn(
			`Revalidate request to ${base_url} failed (${response.status}) -- the live server's cache may stay stale until its 1h TTL expires.`,
		);
	}
}

async function main() {
	const slug = process.argv[2];
	if (!slug || !is_static_page_slug(slug)) {
		throw new Error(
			`Usage: publish-content-page.ts <${Object.keys(STATIC_PAGES).join("|")}>`,
		);
	}
	const { title } = STATIC_PAGES[slug];

	const draft = await find_existing_content_draft(title);
	if (!draft) throw new Error(`No content-kind draft titled "${title}"`);

	try {
		const { article, slug: published_slug } = await publish_article({
			article_id: draft.id,
			article: { title },
			author_ids: [],
		});
		console.log(`Published ${title} (${article.id}) -> /${published_slug}`);
	} catch (error) {
		// `publish_article`'s DB write and Algolia sync both happen *before*
		// its own `apply_server_invalidations("article.published")` call,
		// which throws here -- `updateTag` only works inside a live Server
		// Action, and this script's process is never one. The publish itself
		// already succeeded; only the live server's cache is stale. Confirm
		// that by re-reading the row rather than assuming, then hand the
		// invalidation to a process that actually can do it.
		if (
			!(error instanceof Error) ||
			!error.message.includes(UPDATE_TAG_OUTSIDE_ACTION_MESSAGE)
		) {
			throw error;
		}

		const published = await find_article_with_relations(
			db,
			eq(Article.id, draft.id),
		);
		if (published?.status !== "published") throw error;

		const published_slug = find_primary_slug_or_first(
			published.article_slugs,
		)?.slug;
		console.log(`Published ${title} (${published.id}) -> /${published_slug}`);
	}

	await notify_live_server();
}

main()
	.catch((error: unknown) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
