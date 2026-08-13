/**
 * Static-page migration pilot, media post-pass (#36): finds every reference
 * still pointing at the old `vsebina.jknm.org` self-host -- both `.pdf`
 * anchors inline in prose and `image` blocks' `file.url` (`html-to-blocks.ts`
 * deliberately leaves both pointing at the original hotlink, see its doc
 * comment) -- re-ingests each one into `jknm-gradivo` via
 * `ingest_media_from_url` (`src/server/media/ingest.ts`, content-addressed by
 * sha256 so re-running is safe), and repoints the URL at the new,
 * self-hosted `media` row wherever it occurs in the serialized blocks.
 *
 * Dry-run by default, per the map's (#33) standing convention: logs the
 * intended rewrites to `artifacts/<slug>-vsebina-postpass-plan.json` without
 * touching the DB or B2. Pass `--execute` to actually ingest and write back.
 *
 * Usage:
 *   dotenv -e .env.local -e .env.staging --override -- \
 *     bun run scripts/migrate/vsebina-postpass.ts <article-id> --slug=zgodovina
 *   dotenv -e .env.local -e .env.staging --override -- \
 *     bun run scripts/migrate/vsebina-postpass.ts <article-id> --slug=zgodovina --execute
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { Article, type ArticleContentType } from "~/server/db/schema";
import { ingest_media_from_url } from "~/server/media/ingest";

const OLD_VSEBINA_URL_RE = /https:\/\/vsebina\.jknm\.org\/[^"'\s\\<>)]+/g;

interface PlanEntry {
	old_url: string;
	status: "would-ingest" | "ingested" | "fetch-failed";
	new_url?: string;
	media_id?: string;
}

async function main() {
	const args = process.argv.slice(2);
	const article_id = args.find((a) => !a.startsWith("--"));
	const execute = args.includes("--execute");
	const slug =
		args.find((a) => a.startsWith("--slug="))?.split("=")[1] ?? "page";

	if (!article_id) {
		throw new Error(
			"Usage: vsebina-postpass.ts <article-id> --slug=<name> [--execute]",
		);
	}

	const article = await db.query.Article.findFirst({
		where: eq(Article.id, article_id),
	});
	if (!article) throw new Error(`No article ${article_id}`);

	const content = article.content_json;
	let serialized = JSON.stringify(content);
	const old_urls = [...new Set(serialized.match(OLD_VSEBINA_URL_RE) ?? [])];

	console.log(
		`${old_urls.length} unique vsebina.jknm.org reference(s) in article ${article_id}`,
	);

	const plan: PlanEntry[] = [];
	const PROGRESS_EVERY = 10;

	for (const [index, old_url] of old_urls.entries()) {
		if (index > 0 && index % PROGRESS_EVERY === 0) {
			console.log(`  -- progress: ${index}/${old_urls.length} --`);
		}

		if (!execute) {
			const response = await fetch(old_url, { method: "HEAD" }).catch(
				() => null,
			);
			plan.push({
				old_url,
				status: response?.ok ? "would-ingest" : "fetch-failed",
			});
			console.log(
				`  [dry-run] ${old_url} -> ${response?.ok ? "reachable" : "UNREACHABLE"}`,
			);
			continue;
		}

		const media = await ingest_media_from_url(old_url);
		if (!media) {
			plan.push({ old_url, status: "fetch-failed" });
			console.warn(`  FAILED to ingest ${old_url}`);
			continue;
		}

		const new_url = media.original.url;
		serialized = serialized.split(old_url).join(new_url);
		plan.push({ old_url, status: "ingested", new_url, media_id: media.id });
		console.log(`  ${old_url} -> ${new_url} (media ${media.id})`);
	}

	if (execute) {
		await db
			.update(Article)
			.set({ content_json: JSON.parse(serialized) as ArticleContentType })
			.where(eq(Article.id, article_id));
		console.log(
			`\nWrote back article ${article_id} with ${plan.length} reference(s) repointed.`,
		);
	}

	const artifacts_dir = path.join(import.meta.dirname, "..", "..", "artifacts");
	await mkdir(artifacts_dir, { recursive: true });
	const plan_path = path.join(
		artifacts_dir,
		`${slug}-vsebina-postpass-plan.json`,
	);
	await writeFile(plan_path, JSON.stringify(plan, null, 2));
	console.log(`Plan written to ${plan_path}`);
}

main()
	.catch((error: unknown) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
