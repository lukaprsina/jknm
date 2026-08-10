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

import { publish_article } from "~/server/article/new-article";
import { find_existing_content_draft } from "./create-draft";
import { is_static_page_slug, STATIC_PAGES } from "./pages";

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

	const { article, slug: published_slug } = await publish_article({
		article_id: draft.id,
		article: { title },
		author_ids: [],
	});

	console.log(`Published ${title} (${article.id}) -> /${published_slug}`);
}

main()
	.catch((error: unknown) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
