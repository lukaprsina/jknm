import { db } from "~/server/db";
import { Article } from "~/server/db/schema";

/**
 * Read-only audit: what old-site (`jknm.si`) references still live inside
 * article `content_json`, bucketed by link shape. Sizing input for the
 * article-level dehotlinking work (the EditorJS counterpart of
 * `scripts/dehotlink-static-pages.ts`, deferred in §7 of
 * docs/research/static-pages-jknm-si-dehotlinking.md).
 *
 * Usage: bun run scripts/audit-article-hotlinks.ts
 */

const URL_RE = /https?:\/\/[^\s"'<>)\\]+/g;

function classify(url: string) {
	if (!/jknm\.si/i.test(url)) return null;
	// The dump contains concatenated junk like `http://www.jknm.sihttps://...`
	if (/jknm\.si(?:https?:)/i.test(url)) return "malformed-concat";
	if (/jknm\.si\/si\/\?id=/i.test(url)) return "article-link";
	if (/jknm\.si\/media\//i.test(url)) return "media-file";
	if (/jknm\.si\/si\//i.test(url)) return "static-page-link";
	return "other";
}

async function main() {
	const rows = await db
		.select({
			id: Article.id,
			legacy_id: Article.legacy_id,
			status: Article.status,
			title: Article.title,
			content_json: Article.content_json,
		})
		.from(Article);

	const by_kind = new Map<string, Map<string, number>>();
	const articles_by_kind = new Map<string, Set<string>>();
	const ext_counts = new Map<string, number>();

	for (const row of rows) {
		if (!row.content_json) continue;
		const raw = JSON.stringify(row.content_json);
		for (const url of raw.match(URL_RE) ?? []) {
			const kind = classify(url);
			if (!kind) continue;
			const urls = by_kind.get(kind) ?? new Map<string, number>();
			urls.set(url, (urls.get(url) ?? 0) + 1);
			by_kind.set(kind, urls);
			const arts = articles_by_kind.get(kind) ?? new Set<string>();
			arts.add(`${row.legacy_id ?? "-"} ${row.status} ${row.title}`);
			articles_by_kind.set(kind, arts);
			if (kind === "media-file") {
				const ext = (
					/\.([a-z0-9]{1,5})(?:\?|$)/i.exec(url)?.[1] ?? "none"
				).toLowerCase();
				ext_counts.set(ext, (ext_counts.get(ext) ?? 0) + 1);
			}
		}
	}

	// Overall host histogram: jknm.si is only one of the possible stale hosts.
	const hosts = new Map<string, number>();
	for (const row of rows) {
		if (!row.content_json) continue;
		for (const url of JSON.stringify(row.content_json).match(URL_RE) ?? []) {
			const host = /^https?:\/\/([^/]+)/i.exec(url)?.[1] ?? "?";
			hosts.set(host, (hosts.get(host) ?? 0) + 1);
		}
	}
	console.log("hosts:");
	for (const [host, n] of [...hosts].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
		console.log(`  ${n}\t${host}`);
	}

	console.log(`\n${rows.length} articles scanned.\n`);
	for (const [kind, urls] of [...by_kind].sort()) {
		const total = [...urls.values()].reduce((a, b) => a + b, 0);
		console.log(
			`${kind}: ${total} refs, ${urls.size} distinct, ${articles_by_kind.get(kind)?.size ?? 0} articles`,
		);
		for (const [url, n] of [...urls].slice(0, 8)) {
			console.log(`    ${n}x ${url}`);
		}
	}
	if (ext_counts.size) {
		console.log(`\nmedia-file extensions: ${JSON.stringify([...ext_counts])}`);
	}
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
