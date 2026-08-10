/**
 * Static-page migration pilot, end to end (#36): fetches an already-live
 * `/zgodovina`-style route's server-rendered HTML with a plain `fetch` (no
 * browser -- these are server components, so the response is already the
 * final markup), converts it with `html-to-blocks.ts`, and writes the result
 * straight into a fresh admin draft via `create-draft.ts`'s direct DB insert.
 *
 * This always writes for real -- there's no "dry" version of creating the
 * pilot draft, that IS the pilot. Nothing gets published; QA the resulting
 * draft by eye, then run `vsebina-postpass.ts` against its id to repoint the
 * image/PDF urls it still carries at the self-hosted copies.
 *
 * Usage:
 *   dotenv -e .env.local -e .env.staging --override -- \
 *     bun run scripts/migrate/migrate-static-page.ts zgodovina
 *   dotenv -e .env.local -e .env.staging --override -- \
 *     bun run scripts/migrate/migrate-static-page.ts zgodovina --admin-email=you@jknm.si
 */

import { eq } from "drizzle-orm";
import { env } from "~/env.js";
import { db } from "~/server/db";
import { Article } from "~/server/db/schema";
import {
	create_draft,
	find_existing_content_draft,
	pick_admin_user_id,
} from "./create-draft";
import { extract_static_content_html, html_to_blocks } from "./html-to-blocks";
import { is_static_page_slug, STATIC_PAGES } from "./pages";

async function main() {
	const args = process.argv.slice(2);
	const slug = args.find((a) => !a.startsWith("--"));
	const admin_email_arg = args
		.find((a) => a.startsWith("--admin-email="))
		?.split("=")[1];

	if (!slug || !is_static_page_slug(slug)) {
		throw new Error(
			`Usage: migrate-static-page.ts <${Object.keys(STATIC_PAGES).join("|")}> [--admin-email=...]`,
		);
	}
	const page_config = STATIC_PAGES[slug];

	const page_url = new URL(page_config.route, env.BETTER_AUTH_URL).toString();
	const response = await fetch(page_url);
	if (!response.ok) {
		throw new Error(`GET ${page_url} -> ${response.status}`);
	}
	const page_html = await response.text();

	const container_html = extract_static_content_html(page_html);
	const blocks = html_to_blocks(container_html);
	console.log(`Converted ${blocks.length} block(s) from ${page_url}`);

	const admin_id = await pick_admin_user_id(admin_email_arg);
	const existing = await find_existing_content_draft(page_config.title);
	const draft = existing ?? (await create_draft(page_config.title, admin_id));
	if (existing) {
		console.log(`Reusing existing draft ${draft.id} (rerun of a prior attempt)`);
	}
	// Keep only the seeded h1 header block (index 0) as the prefix -- on a
	// reused draft the rest is last run's converted content, which this run
	// is replacing outright, not appending to.
	blocks.unshift(...(draft.content_json?.blocks?.slice(0, 1) ?? []));

	await db
		.update(Article)
		.set({ content_json: { blocks } })
		.where(eq(Article.id, draft.id));

	const draft_url = new URL(`/uredi/${draft.id}`, env.BETTER_AUTH_URL).toString();
	console.log(`\nDone. Draft: ${draft_url}`);
	console.log(
		"\nNext: QA the draft by eye (headings/lists/images/sup), then run " +
			`vsebina-postpass.ts against ${draft.id} to repoint image/PDF urls.`,
	);
}

main()
	.catch((error: unknown) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
