import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

/**
 * One-off: downloads the old-CMS article pages (https://www.jknm.si/si/?id=N)
 * that fall outside artifacts/Objave.txt's coverage — the DB export the old
 * admin gave us stops at legacy_id 625 (scripts/check-legacy-articles.ts,
 * scripts/fix-legacy-ids-by-date.ts), so anything published after that point
 * has no source of truth except the live site itself.
 *
 * Saves raw HTML to artifacts/legacy-html/<id>.html (gitignored — this is
 * scrape input for a follow-up script, not something to commit). Skips ids
 * already downloaded, so it's safe to re-run/extend a range.
 *
 * The old ASP server returns HTTP 200 with a generic HTML error page for
 * some missing/malformed ids instead of a real 404 (see
 * scripts/dehotlink-static-pages.ts's is_pdf/fetch_live_pdf comment for the
 * same quirk on PDF urls) — so a 200 here doesn't guarantee a real article,
 * just that *something* was saved. The follow-up script sorts that out.
 *
 * Usage:
 *   bun run scripts/scrape-legacy-articles.ts --start 602 --end 750
 *   bun run scripts/scrape-legacy-articles.ts --start 602 --end 750 --force   # re-download existing files
 */

const OUT_DIR = path.join("artifacts", "legacy-html");
const TIMEOUT_MS = 15_000;
const DELAY_BETWEEN_REQUESTS_MS = 250;

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetch_with_timeout(url: string, timeout_ms: number) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeout_ms);
	try {
		return await fetch(url, { signal: controller.signal });
	} finally {
		clearTimeout(timer);
	}
}

async function main() {
	const { values } = parseArgs({
		options: {
			start: { type: "string" },
			end: { type: "string" },
			force: { type: "boolean" },
		},
	});

	const start = Number(values.start ?? 602);
	const end = Number(values.end ?? 750);
	const force = values.force ?? false;

	if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
		throw new Error(`invalid --start/--end: ${start}..${end}`);
	}

	await fs.mkdir(OUT_DIR, { recursive: true });

	let downloaded = 0;
	let skipped_existing = 0;
	let failed = 0;

	for (let id = start; id <= end; id++) {
		const out_path = path.join(OUT_DIR, `${id}.html`);

		if (!force) {
			try {
				await fs.access(out_path);
				skipped_existing++;
				continue;
			} catch {
				// doesn't exist yet, fall through to download
			}
		}

		const url = `https://www.jknm.si/si/?id=${id}`;
		try {
			const response = await fetch_with_timeout(url, TIMEOUT_MS);
			const html = await response.text();
			await fs.writeFile(out_path, html, "utf8");
			console.log(`[${id}] ${response.status} -> ${out_path} (${html.length}B)`);
			downloaded++;
		} catch (error) {
			failed++;
			console.error(`[${id}] FAILED: ${(error as Error).message}`);
		}

		await sleep(DELAY_BETWEEN_REQUESTS_MS);
	}

	console.log(
		`\nDone. downloaded=${downloaded} skipped_existing=${skipped_existing} failed=${failed}`,
	);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
