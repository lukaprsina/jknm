import { brotliCompressSync, gzipSync } from "node:zlib";
import { persist, restore } from "@zbsearch/plugin-data-persistence";
import { pluginQPS } from "@zbsearch/plugin-qps";
import { language, stemmer } from "@zbsearch/stemmers/slovenian";
import { eq } from "drizzle-orm";
import { create, insert, search } from "zbsearch";
import { format_author_sort_name } from "~/lib/author-name";
import { convert_content_to_text } from "~/lib/content-to-text";
import { find_primary_slug_or_first } from "~/server/article/lifecycle-rules";
import { db } from "~/server/db";
import { Article } from "~/server/db/schema";

/**
 * zbsearch counterpart to orama-bench.ts (issue #45) — same benchmark, but
 * against micheleriva/zbsearch (the Orama team's fork) instead of
 * oramasearch/orama, with real Slovenian stemming enabled since
 * @zbsearch/stemmers actually ships it (unlike @orama/stemmers@3.1.18).
 *
 * @zbsearch/plugin-data-persistence and @zbsearch/plugin-qps are published
 * with an unresolved "zbsearch": "workspace:*" dependency (a monorepo
 * publish bug) — worked around with a root "zbsearch": "4.0.0" entry in
 * package.json's `overrides`, which rewrites that specifier wherever it
 * shows up in the graph, not just top-level version ranges.
 *
 * Usage: bun run scripts/zbsearch-bench.ts
 */

const SCHEMA = {
	title: "string",
	body: "string",
	author: "string",
	year: "string",
	published_at: "number",
} as const;

async function load_articles() {
	const rows = await db.query.Article.findMany({
		where: eq(Article.status, "published"),
		with: {
			article_slugs: true,
			articles_to_authors: {
				with: { author: true },
				orderBy: (relation, { asc: order_asc }) => order_asc(relation.order),
			},
		},
	});

	return rows.map((row) => {
		const first_author = row.articles_to_authors.at(0)?.author;
		return {
			title: row.title,
			body: convert_content_to_text(row.content_json?.blocks),
			author: first_author ? format_author_sort_name(first_author) : "",
			year: row.published_at ? row.published_at.getFullYear().toString() : "",
			published_at: row.published_at ? row.published_at.getTime() : 0,
			_slug: find_primary_slug_or_first(row.article_slugs)?.slug ?? "",
		};
	});
}

function fmt_bytes(n: number) {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function byte_length(serialized: string | Buffer | ArrayBuffer): number {
	if (typeof serialized === "string") return Buffer.byteLength(serialized);
	if (Buffer.isBuffer(serialized)) return serialized.length;
	return serialized.byteLength;
}

async function bench_format(
	db_instance: Awaited<ReturnType<typeof create>>,
	format: "json" | "binary" | "seqproto",
) {
	const serialized = await persist(db_instance, format);
	const raw_size = byte_length(serialized);

	const transfer_size =
		format === "binary" ? Math.ceil(raw_size / 2) : raw_size;

	const buf =
		typeof serialized === "string"
			? Buffer.from(serialized)
			: Buffer.isBuffer(serialized)
				? serialized
				: Buffer.from(serialized);

	const gzip_size = gzipSync(buf).length;
	const brotli_size = brotliCompressSync(buf).length;

	const heap_before = process.memoryUsage().heapUsed;
	const restore_start = performance.now();
	const restored = await restore(format, serialized);
	const restore_ms = performance.now() - restore_start;
	const heap_after = process.memoryUsage().heapUsed;

	const search_start = performance.now();
	const results = await search(restored, { term: "jama", limit: 10 });
	const search_ms = performance.now() - search_start;

	return {
		format,
		raw_size,
		transfer_size,
		gzip_size,
		brotli_size,
		restore_ms,
		heap_delta: heap_after - heap_before,
		search_ms,
		hit_count: results.count,
	};
}

async function main() {
	console.log("Loading published articles...");
	const articles = await load_articles();
	console.log(`${articles.length} published article(s) loaded.`);

	const total_body_bytes = articles.reduce(
		(sum, a) => sum + Buffer.byteLength(a.body),
		0,
	);
	console.log(
		`Total plaintext body size: ${fmt_bytes(total_body_bytes)} across ${articles.length} docs.`,
	);

	console.log("\nBuilding BM25 index (real Slovenian stemming)...");
	const bm25_db = create({
		schema: SCHEMA,
		components: {
			tokenizer: { stemming: true, stemmer, language },
		},
	});
	for (const article of articles) {
		insert(bm25_db, {
			title: article.title,
			body: article.body,
			author: article.author,
			year: article.year,
			published_at: article.published_at,
		});
	}

	console.log("Building QPS index (real Slovenian stemming)...");
	const qps_db = create({
		schema: SCHEMA,
		components: {
			tokenizer: { stemming: true, stemmer, language },
		},
		plugins: [pluginQPS()],
	});
	for (const article of articles) {
		insert(qps_db, {
			title: article.title,
			body: article.body,
			author: article.author,
			year: article.year,
			published_at: article.published_at,
		});
	}

	const formats: Array<"json" | "binary" | "seqproto"> = [
		"json",
		"binary",
		"seqproto",
	];

	const print_result = (r: Awaited<ReturnType<typeof bench_format>>) =>
		console.log(
			`${r.format.padEnd(9)} raw=${fmt_bytes(r.raw_size).padEnd(9)} transfer=${fmt_bytes(r.transfer_size).padEnd(9)} gzip=${fmt_bytes(r.gzip_size).padEnd(9)} brotli=${fmt_bytes(r.brotli_size).padEnd(9)} restore=${r.restore_ms.toFixed(1)}ms heap=${fmt_bytes(r.heap_delta).padEnd(9)} search=${r.search_ms.toFixed(2)}ms hits=${r.hit_count}`,
		);

	console.log("\n=== BM25 ===");
	for (const format of formats) {
		print_result(await bench_format(bm25_db, format));
	}

	console.log("\n=== QPS ===");
	for (const format of formats) {
		try {
			print_result(await bench_format(qps_db, format));
		} catch (error) {
			console.log(
				`${format.padEnd(9)} FAILED — plugin-data-persistence cannot restore a QPS-plugin'd index: ${(error as Error).message}`,
			);
		}
	}

	process.exit(0);
}

void main();
