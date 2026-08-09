/**
 * Static-page migration pilot, paste phase (#36): creates a fresh admin
 * draft and pastes a static page's already-rendered HTML into it, exercising
 * the real paste-to-EditorJS-blocks pipeline -- including the real
 * `@editorjs/image` `pasteConfig`, which genuinely uploads through
 * `/api/media` (`src/components/editor/plugins.ts`, confirmed in
 * `docs/research/static-sites-to-articles-migration.md` and #33's decision
 * record).
 *
 * Render mechanics (#36's open question, decided here): no separate
 * MDX -> HTML render step. `/zgodovina` (etc, `src/app/(static)/*\/page.tsx`)
 * is already a real, working route rendering exactly the HTML that needs
 * migrating -- simpler and more accurate than standing up a throwaway
 * render route or calling `ReactDOMServer` by hand, since it's the actual
 * production render, images and all. `TableOfContents`/`ImageGallery` both
 * render via `createPortal` elsewhere in the DOM (`table-of-contents.tsx`,
 * `image-gallery.tsx`), so the container wrapping the page's `<h1>` holds
 * exactly the MDX content, nothing else to strip out.
 *
 * Auth: Google OAuth can't be scripted. Run
 * `scripts/migrate/capture-admin-session.ts` once first (interactive,
 * headed) to save a real session to `scripts/.cache/admin-storage-state.json`
 * -- this script loads that file rather than signing in itself.
 *
 * Draft creation happens as a direct DB insert mirroring `create_article`
 * (`src/server/article/new-article.ts`), not a UI click -- `createArticle`
 * is an `@orpc/next` server action, not a stable fetchable endpoint, and the
 * "+" new-draft button has no reliable selector to target from here. This
 * keeps things robust without giving up anything the pilot needs to prove:
 * the part that has to go through the real browser/app is the *paste*, not
 * the empty-draft bootstrap.
 *
 * PDF links (e.g. `<a href="https://vsebina.jknm.org/media/pdf/x.pdf">`)
 * survive the paste as plain inline links -- EditorJS has no paste rule that
 * upgrades a link into an `attaches` block. That's left to
 * `pdf-postpass.ts`, deliberately: `extract_inline_media_urls`
 * (`src/lib/editor-utils.ts`) already treats an inline
 * `<a href="https://gradivo.jknm.org/...">` as a first-class media
 * reference, exactly how news articles link PDFs from prose today -- so
 * repointing the href at the self-hosted copy is the right amount of
 * conversion, not forcing every PDF into a detached `attaches` card.
 *
 * This script always writes for real once it runs -- there's no "dry"
 * version of "paste into a real staging draft", that IS the pilot. Nothing
 * gets published; QA the resulting draft by eye (this is expected to take
 * a few passes, not a one-shot success -- see #33/#36).
 *
 * Usage:
 *   dotenv -e .env.local -e .env.staging --override -- bun run scripts/migrate/paste-static-page.ts zgodovina
 *   dotenv -e .env.local -e .env.staging --override -- bun run scripts/migrate/paste-static-page.ts zgodovina --headless
 */

import { eq } from "drizzle-orm";
import { chromium } from "playwright";
import { env } from "~/env.js";
import { db } from "~/server/db";
import { Article, type ArticleBlockType, users } from "~/server/db/schema";
import { STORAGE_STATE_PATH } from "./capture-admin-session";
import { is_static_page_slug, STATIC_PAGES } from "./pages";

const POLL_INTERVAL_MS = 3_000;
const SETTLE_CHECKS_REQUIRED = 3;
const MAX_WAIT_MS = 15 * 60 * 1000;

async function pick_admin_user_id(admin_email: string | undefined) {
	const row = admin_email
		? await db.query.users.findFirst({ where: eq(users.email, admin_email) })
		: await db.query.users.findFirst();
	if (!row) {
		throw new Error(
			admin_email
				? `No user row for ${admin_email}`
				: "No user rows exist -- sign in once via the app first.",
		);
	}
	return row.id;
}

/** Mirrors `create_article` (`src/server/article/new-article.ts`) as a
 * direct DB insert -- see the file doc comment for why this bypasses the
 * oRPC action instead of calling it. */
async function create_draft(title: string, created_by: string) {
	const [created] = await db
		.insert(Article)
		.values({
			title,
			status: "draft",
			content_json: {
				blocks: [{ id: "sheNwCUP5A", type: "header", data: { text: title, level: 1 } }],
			},
			created_by,
		})
		.returning();
	if (!created) throw new Error("Insert returned no row");
	return created;
}

function block_pending_upload(block: ArticleBlockType): boolean {
	if (block.type === "image") {
		const file = (block.data as { file?: { url?: string } }).file;
		return !file?.url;
	}
	if (block.type === "attaches") {
		const file = (block.data as { file?: { url?: string } }).file;
		return !file?.url;
	}
	return false;
}

async function wait_for_paste_to_settle(article_id: string) {
	let previous_block_count = -1;
	let stable_checks = 0;
	const deadline = Date.now() + MAX_WAIT_MS;

	while (Date.now() < deadline) {
		await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

		const row = await db.query.Article.findFirst({
			where: eq(Article.id, article_id),
		});
		if (!row) throw new Error("Draft disappeared mid-run");
		if (!row.content_json) throw new Error("Draft has no content_json");

		const content = row.content_json;
		const pending = content.blocks.filter(block_pending_upload).length;
		const block_count = content.blocks.length;

		console.log(
			`  poll: ${block_count} block(s), ${pending} upload(s) pending`,
		);

		if (block_count === previous_block_count && pending === 0) {
			stable_checks++;
			if (stable_checks >= SETTLE_CHECKS_REQUIRED) return content;
		} else {
			stable_checks = 0;
		}
		previous_block_count = block_count;
	}

	throw new Error(
		`Timed out after ${MAX_WAIT_MS}ms waiting for paste/uploads to settle`,
	);
}

async function main() {
	const args = process.argv.slice(2);
	const slug = args.find((a) => !a.startsWith("--"));
	const headless = args.includes("--headless");
	const admin_email_arg = args
		.find((a) => a.startsWith("--admin-email="))
		?.split("=")[1];

	if (!slug || !is_static_page_slug(slug)) {
		throw new Error(
			`Usage: paste-static-page.ts <${Object.keys(STATIC_PAGES).join("|")}> [--headless] [--admin-email=...]`,
		);
	}
	const page_config = STATIC_PAGES[slug];

	const admin_id = await pick_admin_user_id(admin_email_arg);
	const draft = await create_draft(page_config.title, admin_id);
	console.log(`Created draft ${draft.id} ("${page_config.title}")`);

	const base_url = env.BETTER_AUTH_URL;
	const browser = await chromium.launch({ headless });
	const context = await browser.newContext({
		storageState: STORAGE_STATE_PATH,
	});

	try {
		const source_page = await context.newPage();
		await source_page.goto(new URL(page_config.route, base_url).toString());
		await source_page.waitForSelector("h1");

		const { html, image_count, pdf_count } = await source_page.evaluate(() => {
			const h1 = document.querySelector("h1");
			const container = h1?.parentElement;
			if (!container) throw new Error("Couldn't find the content container");
			return {
				html: container.innerHTML,
				image_count: container.querySelectorAll("img").length,
				pdf_count: [...container.querySelectorAll("a[href$='.pdf']")].length,
			};
		});
		console.log(
			`Extracted content HTML: ${html.length} chars, ${image_count} <img>, ${pdf_count} .pdf link(s)`,
		);
		await source_page.close();

		const draft_page = await context.newPage();
		await draft_page.goto(new URL(`/uredi/${draft.id}`, base_url).toString());
		if (draft_page.url().includes("/prijava")) {
			throw new Error(
				"Redirected to /prijava -- saved session expired, re-run capture-admin-session.ts",
			);
		}
		await draft_page.waitForSelector("#editorjs .ce-block");

		// Put the caret at the end of the seeded block and open a fresh empty
		// block below it for the paste to land in, rather than pasting into the
		// title header itself.
		await draft_page.locator("#editorjs .ce-block").last().click();
		await draft_page.keyboard.press("End");
		await draft_page.keyboard.press("Enter");

		await draft_page.evaluate((pasted_html) => {
			const target = document.activeElement;
			if (!target) throw new Error("No focused element to paste into");
			const data_transfer = new DataTransfer();
			data_transfer.setData("text/html", pasted_html);
			target.dispatchEvent(
				new ClipboardEvent("paste", {
					clipboardData: data_transfer,
					bubbles: true,
					cancelable: true,
				}),
			);
		}, html);

		console.log("Dispatched paste, waiting for blocks + image uploads to settle...");
		const final_content = await wait_for_paste_to_settle(draft.id);
		const remaining_pdf_links = JSON.stringify(final_content.blocks).match(
			/https:\/\/vsebina\.jknm\.org\/[^"'\s\\<>)]+\.pdf/g,
		);

		console.log(`\nDone. ${final_content.blocks.length} block(s) in draft.`);
		console.log(`Draft: ${new URL(`/uredi/${draft.id}`, base_url).toString()}`);
		console.log(
			`PDF links to resolve via pdf-postpass.ts: ${remaining_pdf_links?.length ?? 0}`,
		);
		console.log(
			"\nNext: open the draft, QA it by eye (headings/tables/images/superscript), " +
				"then run pdf-postpass.ts against this article id.",
		);
	} finally {
		await browser.close();
	}
}

main()
	.catch((error: unknown) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
