import fs from "node:fs/promises";
import { and, eq } from "drizzle-orm";
import { strip_html_to_text } from "~/lib/sanitize-html";
import { db } from "~/server/db";
import { Article, ArticleSlug } from "~/server/db/schema";

/**
 * Fixes the jumbled /novica/<slug> links found by
 * scripts/crossref-worddoc-links.ts (see artifacts/worddoc-crossref/*.json).
 *
 * Re-walks each page's content_json blocks in the exact same order/shape as
 * crossref-worddoc-links.ts's collect_block_texts + extract_db_links, so the
 * positional anchor-text pairing (needed for duplicate anchors, e.g. Varstvo's
 * repeated "Cvingerska jama" mentions) lines up identically. Before mutating,
 * re-derives each occurrence's current href and aborts the whole page if it
 * doesn't match the recorded db_href from the JSON (content drifted since the
 * audit ran).
 *
 * Dry-run by default (prints old -> new per anchor). Usage:
 *   bun run scripts/fix-worddoc-crossref-links.ts
 *   bun run scripts/fix-worddoc-crossref-links.ts --execute
 */

const OUT_DIR = "artifacts/worddoc-crossref";
const EXECUTE = process.argv.includes("--execute");

const PAGES = ["Raziskovanje", "Varstvo", "Zgodovina"] as const;

interface MismatchRow {
	anchor: string;
	word_doc_legacy_id: number;
	word_doc_target_title: string | null;
	db_href: string | null;
	db_target_title: string | null;
	verdict: string;
}

function normalize_anchor(text: string): string {
	return text.replace(/\*\*/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

const A_TAG_RE = /<a\b[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi;

interface TextRef {
	get: () => string;
	set: (v: string) => void;
}

interface Occurrence {
	ref: TextRef;
	match_start: number;
	match_end: number;
	href: string;
	anchor_norm: string;
}

function collect_text_refs(content_json: unknown): TextRef[] {
	const blocks = (content_json as { blocks?: unknown[] } | null)?.blocks;
	if (!Array.isArray(blocks)) return [];
	const out: TextRef[] = [];
	const walk_items = (items: unknown) => {
		if (!Array.isArray(items)) return;
		for (const raw of items as { content?: unknown; items?: unknown }[]) {
			if (typeof raw.content === "string") {
				out.push({
					get: () => raw.content as string,
					set: (v) => {
						raw.content = v;
					},
				});
			}
			walk_items(raw.items);
		}
	};
	for (const block of blocks) {
		const b = block as {
			data?: { text?: unknown; items?: unknown; content?: unknown };
		};
		if (typeof b.data?.text === "string") {
			const data = b.data;
			out.push({
				get: () => data.text as string,
				set: (v) => {
					data.text = v;
				},
			});
		}
		walk_items(b.data?.items);
		if (Array.isArray(b.data?.content)) {
			for (const row of b.data.content as unknown[]) {
				if (!Array.isArray(row)) continue;
				for (let i = 0; i < row.length; i++) {
					if (typeof row[i] !== "string") continue;
					const cell_row = row as unknown[];
					const idx = i;
					out.push({
						get: () => cell_row[idx] as string,
						set: (v) => {
							cell_row[idx] = v;
						},
					});
				}
			}
		}
	}
	return out;
}

function collect_occurrences(content_json: unknown): Occurrence[] {
	const out: Occurrence[] = [];
	for (const ref of collect_text_refs(content_json)) {
		const text = ref.get();
		for (const m of text.matchAll(A_TAG_RE)) {
			const href = m[1]!;
			if (!href.startsWith("/novica/")) continue;
			const anchor = strip_html_to_text(m[2]!);
			out.push({
				ref,
				match_start: m.index!,
				match_end: m.index! + m[0].length,
				href,
				anchor_norm: normalize_anchor(anchor),
			});
		}
	}
	return out;
}

function replace_href_in_match(
	match_text: string,
	old_href: string,
	new_href: string,
): string {
	return match_text.replace(`href="${old_href}"`, `href="${new_href}"`);
}

async function main() {
	const legacy_articles = await db.query.Article.findMany({
		columns: { id: true, legacy_id: true },
	});
	const by_legacy_id = new Map(
		legacy_articles
			.filter((a) => a.legacy_id !== null)
			.map((a) => [a.legacy_id!, a.id]),
	);

	for (const page_title of PAGES) {
		const rows: MismatchRow[] = JSON.parse(
			await fs.readFile(`${OUT_DIR}/${page_title.toLowerCase()}.json`, "utf8"),
		);
		const mismatches = rows.filter((r) => r.verdict === "mismatch");
		if (mismatches.length === 0) continue;

		const db_page = await db.query.Article.findFirst({
			where: and(
				eq(Article.article_kind, "content"),
				eq(Article.status, "published"),
				eq(Article.title, page_title),
			),
			columns: { id: true, content_json: true },
		});
		if (!db_page) {
			console.log(`! page "${page_title}" not found in DB, skipping`);
			continue;
		}

		const content_json = db_page.content_json;
		const occurrences = collect_occurrences(content_json);
		const used = new Array(occurrences.length).fill(false);

		console.log(`\n== ${page_title} (${mismatches.length} mismatch(es)) ==`);
		let page_ok = true;
		const planned: { row: MismatchRow; occ: Occurrence; new_href: string }[] =
			[];

		for (const row of mismatches) {
			const anchor_norm = normalize_anchor(row.anchor);
			const occ_idx = occurrences.findIndex(
				(o, i) => !used[i] && o.anchor_norm === anchor_norm,
			);
			if (occ_idx === -1) {
				console.log(
					`  ! "${row.anchor}": no matching occurrence found in current content_json (drift?) — skipping page`,
				);
				page_ok = false;
				continue;
			}
			used[occ_idx] = true;
			const occ = occurrences[occ_idx]!;
			if (occ.href !== row.db_href) {
				console.log(
					`  ! "${row.anchor}": current href "${occ.href}" != recorded "${row.db_href}" (drift) — skipping page`,
				);
				page_ok = false;
				continue;
			}

			const target_article_id = by_legacy_id.get(row.word_doc_legacy_id);
			if (!target_article_id) {
				console.log(
					`  ! "${row.anchor}": legacy_id ${row.word_doc_legacy_id} not found — skipping`,
				);
				page_ok = false;
				continue;
			}
			const primary_slug = await db.query.ArticleSlug.findFirst({
				where: and(
					eq(ArticleSlug.article_id, target_article_id),
					eq(ArticleSlug.is_primary, true),
				),
				columns: { slug: true },
			});
			if (!primary_slug) {
				console.log(
					`  ! "${row.anchor}": target article ${target_article_id} has no primary slug — skipping`,
				);
				page_ok = false;
				continue;
			}
			const new_href = `/novica/${primary_slug.slug}`;
			console.log(`  "${row.anchor}": ${occ.href} -> ${new_href}`);
			planned.push({ row, occ, new_href });
		}

		if (!page_ok) {
			console.log(
				`  aborting DB write for "${page_title}" due to warnings above`,
			);
			continue;
		}

		if (!EXECUTE) continue;

		// group by underlying text ref and apply back-to-front so earlier
		// match offsets stay valid even if a replacement changes string length
		const by_ref = new Map<TextRef, typeof planned>();
		for (const p of planned) {
			const list = by_ref.get(p.occ.ref) ?? [];
			list.push(p);
			by_ref.set(p.occ.ref, list);
		}
		for (const [ref, items] of by_ref) {
			items.sort((a, b) => b.occ.match_start - a.occ.match_start);
			let text = ref.get();
			for (const { occ, new_href } of items) {
				const before = text.slice(occ.match_start, occ.match_end);
				const after = replace_href_in_match(before, occ.href, new_href);
				text =
					text.slice(0, occ.match_start) + after + text.slice(occ.match_end);
			}
			ref.set(text);
		}

		await db
			.update(Article)
			.set({ content_json })
			.where(eq(Article.id, db_page.id));
		console.log(`  wrote ${planned.length} fix(es) to "${page_title}"`);
	}

	if (!EXECUTE)
		console.log("\n(dry run — rerun with --execute to write changes)");
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
