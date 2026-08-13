import { parseArgs } from "node:util";
import { eq, ne } from "drizzle-orm";
import {
	aws_fallback_url,
	count_concatenated_prefixes,
	find_stale_asset_urls,
	rewrite_urls,
	strip_concatenated_prefixes,
} from "~/lib/stale-media-refs";
import { reconcile_media_to_articles } from "~/server/article/reconcile-media";
import { db } from "~/server/db";
import type { ArticleContentType } from "~/server/db/schema";
import { Article } from "~/server/db/schema";
import { authorize_b2, ingest_media } from "~/server/media/ingest";

/**
 * One-off: pull every article image and PDF still hosted on a stale bucket
 * into `jknm-gradivo`, and repoint `content_json` at the new copies.
 *
 * Why this is urgent rather than tidy-up: the ~218 references to Backblaze's
 * native endpoint are **404 right now** — those images are broken on
 * published articles today. Their bytes survive only because the original
 * AWS bucket still serves the same keys, and that bucket is on an account
 * this project doesn't control. This script is a rescue with a deadline, not
 * a migration.
 *
 * Ingest and rewrite happen in the same pass, deliberately. A `media` row
 * with nothing pointing at it is exactly what `sweep-stale-content.ts`
 * garbage-collects after 48h, so "rescue the bytes now, fix the links later"
 * would quietly undo itself. Each article commits in its own transaction:
 * ingest is not idempotent (every call mints a new uuid and re-uploads), so
 * partial progress must be durable rather than rolled back and redone.
 *
 * Deleted articles are skipped — they're awaiting hard deletion by the same
 * sweep, so paying to re-host their images would be waste.
 *
 * Usage:
 *   bun run scripts/rescue-stale-media.ts                 # dry run
 *   bun run scripts/rescue-stale-media.ts --limit 2       # dry run, 2 articles
 *   bun run scripts/rescue-stale-media.ts --execute       # ingest + rewrite
 */

/**
 * Fetch bytes for a stale url, falling back to the legacy AWS bucket when the
 * recorded host has already lost them. Returns null (not throws) so one dead
 * asset doesn't strand the other 288 — the summary reports every miss.
 */
async function fetch_stale_asset(url: string) {
	const candidates = [url, aws_fallback_url(url)].filter(
		(candidate): candidate is string => Boolean(candidate),
	);

	for (const candidate of candidates) {
		let response: Response;
		try {
			response = await fetch(candidate);
		} catch (error) {
			console.warn(`      fetch threw for ${candidate}: ${String(error)}`);
			continue;
		}
		if (response.ok) {
			return {
				bytes: Buffer.from(await response.arrayBuffer()),
				content_type:
					response.headers.get("content-type") ?? "application/octet-stream",
				source: candidate,
			};
		}
		console.warn(`      ${response.status} ${candidate}`);
	}

	return null;
}

async function main() {
	const { values } = parseArgs({
		options: { execute: { type: "boolean" }, limit: { type: "string" } },
	});
	const execute = values.execute ?? false;
	const limit = values.limit ? Number(values.limit) : undefined;

	const articles = await db.query.Article.findMany({
		where: ne(Article.status, "deleted"),
		columns: {
			id: true,
			legacy_id: true,
			status: true,
			title: true,
			content_json: true,
		},
	});

	// Only articles that actually need work, so `--limit` bites on those rather
	// than on the first N rows (which are overwhelmingly already clean).
	const affected = articles.filter((article) => {
		if (!article.content_json) return false;
		const raw = strip_concatenated_prefixes(
			JSON.stringify(article.content_json),
		);
		return find_stale_asset_urls(raw).length > 0;
	});

	console.log(
		`${articles.length} live articles, ${affected.length} referencing stale hosts.`,
	);

	const targets = limit ? affected.slice(0, limit) : affected;
	const b2 = execute ? await authorize_b2() : null;

	let ingested = 0;
	const failures: string[] = [];

	for (const article of targets) {
		const original = JSON.stringify(article.content_json);
		const prefix_count = count_concatenated_prefixes(original);
		const stripped = strip_concatenated_prefixes(original);
		const stale_urls = find_stale_asset_urls(stripped);

		console.log(
			`\n[${article.legacy_id ?? "-"}] ${article.title} (${article.status})`,
		);
		console.log(
			`    ${stale_urls.length} stale asset(s)${prefix_count ? `, ${prefix_count} concatenated prefix(es)` : ""}`,
		);

		if (!execute) {
			for (const url of stale_urls) console.log(`    - ${url}`);
			continue;
		}

		const replacements = new Map<string, string>();
		for (const url of stale_urls) {
			const fetched = await fetch_stale_asset(url);
			if (!fetched) {
				failures.push(url);
				continue;
			}

			const media = await ingest_media(
				{
					bytes: fetched.bytes,
					filename: decodeURIComponent(url.split("/").pop() ?? "media"),
					content_type: fetched.content_type,
				},
				{ b2: b2 ?? undefined },
			);

			ingested += 1;
			replacements.set(url, media.original.url);
			console.log(
				`    + ${url}\n      -> ${media.original.url} (${media.variants.length} variants)`,
			);
		}

		// Rewrite even when some assets failed: the ones that were rescued still
		// need repointing, and the failures stay visibly stale for a rerun.
		const rewritten = rewrite_urls(stripped, replacements);
		if (rewritten === original) continue;

		const content = JSON.parse(rewritten) as ArticleContentType;
		await db.transaction(async (tx) => {
			await tx
				.update(Article)
				.set({ content_json: content })
				.where(eq(Article.id, article.id));
			await reconcile_media_to_articles(tx, article.id, content);
		});
	}

	console.log(
		`\n${targets.length} article(s) processed, ${ingested} media ingested, ${failures.length} unrecoverable.`,
	);
	for (const url of failures) console.log(`  UNRECOVERABLE ${url}`);

	if (!execute) {
		console.log(
			"\nDry run only — re-run with --execute to ingest and rewrite.",
		);
	}
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
