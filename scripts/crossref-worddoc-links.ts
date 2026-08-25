import fs from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { strip_html_to_text } from "~/lib/sanitize-html";
import { db } from "~/server/db";
import { Article } from "~/server/db/schema";

/**
 * Cross-references the admin's Word doc (converted with pandoc — see
 * HANDOFF.md / conversation for why pandoc's hrefs are trustworthy and
 * markitdown's aren't: markitdown leaves Word's HYPERLINK field-code garbage
 * baked into ~7 hrefs) against the live evergreen pages in the DB.
 *
 * The Word doc's internal links use the old site's `?id=<legacy_id>` form,
 * which maps 1:1 to `Article.legacy_id` — a much stronger ground truth than
 * title/text matching. For each such link, this resolves the *word doc's*
 * intended target and compares it to whatever `/novica/<slug>` the live DB
 * page currently has for the same anchor text, to catch links jumbled during
 * the original MDX hand-authoring (see the Cvingerska jama case that started
 * this investigation).
 *
 * Report-only. Usage: bun run scripts/crossref-worddoc-links.ts
 */

const PANDOC_PATH = "worddoc/pandoc.md";
const OUT_DIR = "artifacts/worddoc-crossref";

const SECTION_TO_PAGE: Record<string, string> = {
	"Mejniki v zgodovini kluba": "Zgodovina",
	Raziskovanje: "Raziskovanje",
	Publiciranje: "Publiciranje",
	"Varstvo jam": "Varstvo",
	Klub: "Klub",
};

interface WordLink {
	anchor: string;
	anchor_norm: string;
	legacy_id: number;
}

function normalize_anchor(text: string): string {
	return text.replace(/\*\*/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function split_into_h1_sections(md: string): Map<string, string> {
	const lines = md.split("\n");
	const sections = new Map<string, string>();
	let current_title: string | undefined;
	let buf: string[] = [];
	for (const line of lines) {
		const m = /^# (.+)$/.exec(line);
		if (m) {
			if (current_title) sections.set(current_title, buf.join("\n"));
			current_title = m[1]?.trim();
			buf = [];
		} else {
			buf.push(line);
		}
	}
	if (current_title) sections.set(current_title, buf.join("\n"));
	return sections;
}

// pandoc hard-wraps prose at ~80 cols, splitting `[anchor text](url)` across
// lines — join paragraphs (blank-line-separated chunks) into single lines
// before regexing so wrapped links aren't missed.
function join_paragraphs(section_text: string): string[] {
	return section_text
		.split(/\n\s*\n/)
		.map((p) => p.replace(/\n/g, " ").replace(/\s+/g, " ").trim())
		.filter(Boolean);
}

const MD_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;
const LEGACY_ID_RE = /[?&]id=(\d+)/;

function extract_word_links(section_text: string): WordLink[] {
	const out: WordLink[] = [];
	for (const para of join_paragraphs(section_text)) {
		for (const m of para.matchAll(MD_LINK_RE)) {
			const anchor = m[1]!;
			const url = m[2]!;
			const id_match = LEGACY_ID_RE.exec(url);
			if (!id_match) continue; // not an internal article link (e.g. a /media/*.pdf reference)
			out.push({
				anchor,
				anchor_norm: normalize_anchor(anchor),
				legacy_id: Number(id_match[1]),
			});
		}
	}
	return out;
}

interface DbLink {
	anchor: string;
	anchor_norm: string;
	href: string;
	slug: string;
	context: string;
}

const A_TAG_RE = /<a\b[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi;

function snippet_around(text: string, needle: string, radius = 200): string {
	const at = text.indexOf(needle);
	if (at === -1) return strip_html_to_text(text).slice(0, radius * 2);
	const start = Math.max(0, at - radius);
	const end = Math.min(text.length, at + needle.length + radius);
	return `${start > 0 ? "…" : ""}${strip_html_to_text(text.slice(start, end))}${end < text.length ? "…" : ""}`;
}

function collect_block_texts(content_json: unknown): string[] {
	const blocks = (content_json as { blocks?: unknown[] } | null)?.blocks;
	if (!Array.isArray(blocks)) return [];
	const out: string[] = [];
	const walk_items = (items: unknown) => {
		if (!Array.isArray(items)) return;
		for (const raw of items as { content?: unknown; items?: unknown }[]) {
			if (typeof raw.content === "string") out.push(raw.content);
			walk_items(raw.items);
		}
	};
	for (const block of blocks) {
		const b = block as {
			data?: { text?: unknown; items?: unknown; content?: unknown };
		};
		if (typeof b.data?.text === "string") out.push(b.data.text);
		walk_items(b.data?.items);
		if (Array.isArray(b.data?.content)) {
			for (const row of b.data.content as unknown[]) {
				if (!Array.isArray(row)) continue;
				for (const cell of row as unknown[]) {
					if (typeof cell === "string") out.push(cell);
				}
			}
		}
	}
	return out;
}

function extract_db_links(content_json: unknown): DbLink[] {
	const out: DbLink[] = [];
	for (const text of collect_block_texts(content_json)) {
		for (const m of text.matchAll(A_TAG_RE)) {
			const href = m[1]!;
			if (!href.startsWith("/novica/")) continue;
			const anchor = strip_html_to_text(m[2]!);
			out.push({
				anchor,
				anchor_norm: normalize_anchor(anchor),
				href,
				slug: href.replace(/^\/novica\//, ""),
				context: snippet_around(text, m[0]!),
			});
		}
	}
	return out;
}

interface CrossrefRow {
	anchor: string;
	word_doc_legacy_id: number;
	word_doc_target_title: string | null;
	word_doc_target_status: string | null;
	db_href: string | null;
	db_target_title: string | null;
	db_target_status: string | null;
	db_context: string | null;
	verdict: "match" | "mismatch" | "db_link_missing" | "word_target_not_found";
}

async function main() {
	const pandoc_md = (await fs.readFile(PANDOC_PATH, "utf8")).replace(
		/\r\n/g,
		"\n",
	);
	const sections = split_into_h1_sections(pandoc_md);

	const legacy_articles = await db.query.Article.findMany({
		columns: { id: true, legacy_id: true, title: true, status: true },
	});
	const by_legacy_id = new Map(
		legacy_articles
			.filter((a) => a.legacy_id !== null)
			.map((a) => [a.legacy_id!, a]),
	);

	await fs.rm(OUT_DIR, { recursive: true, force: true });
	await fs.mkdir(OUT_DIR, { recursive: true });

	const all_mismatches = new Map<string, CrossrefRow[]>();

	for (const [section_title, page_title] of Object.entries(SECTION_TO_PAGE)) {
		const section_text = sections.get(section_title);
		if (!section_text) {
			console.log(`! section "${section_title}" not found in ${PANDOC_PATH}`);
			continue;
		}
		const word_links = extract_word_links(section_text);

		const db_page = await db.query.Article.findFirst({
			where: and(
				eq(Article.article_kind, "content"),
				eq(Article.status, "published"),
				eq(Article.title, page_title),
			),
			columns: { content_json: true },
		});
		const db_links = db_page ? extract_db_links(db_page.content_json) : [];
		const used = new Array(db_links.length).fill(false);

		const rows: CrossrefRow[] = [];
		for (const wl of word_links) {
			const word_target = by_legacy_id.get(wl.legacy_id);

			// find the next not-yet-used db link with the same normalized anchor
			const db_idx = db_links.findIndex(
				(dl, i) => !used[i] && dl.anchor_norm === wl.anchor_norm,
			);
			if (db_idx !== -1) used[db_idx] = true;
			const db_link = db_idx !== -1 ? db_links[db_idx] : undefined;

			rows.push({
				anchor: wl.anchor,
				word_doc_legacy_id: wl.legacy_id,
				word_doc_target_title: word_target?.title ?? null,
				word_doc_target_status: word_target?.status ?? null,
				db_href: db_link?.href ?? null,
				db_target_title: null, // filled below via slug lookup
				db_target_status: null,
				db_context: db_link?.context ?? null,
				verdict: !word_target
					? "word_target_not_found"
					: !db_link
						? "db_link_missing"
						: "mismatch", // corrected below once db target is resolved
			});
		}

		// resolve db target titles by slug (separate pass, needs ArticleSlug)
		for (const row of rows) {
			if (!row.db_href) continue;
			const slug = row.db_href.replace(/^\/novica\//, "");
			const slug_row = await db.query.ArticleSlug.findFirst({
				where: (s, { eq: eq_ }) => eq_(s.slug, slug),
				columns: { article_id: true },
			});
			if (!slug_row) continue;
			const target = await db.query.Article.findFirst({
				where: eq(Article.id, slug_row.article_id),
				columns: { title: true, status: true, legacy_id: true },
			});
			if (!target) continue;
			row.db_target_title = target.title;
			row.db_target_status = target.status;
			row.verdict =
				target.legacy_id === row.word_doc_legacy_id
					? "match"
					: row.word_doc_target_title
						? "mismatch"
						: "word_target_not_found";
		}

		rows.sort((a, b) =>
			a.verdict === b.verdict ? 0 : a.verdict === "mismatch" ? -1 : 1,
		);
		const out_path = path.join(OUT_DIR, `${page_title.toLowerCase()}.json`);
		await fs.writeFile(out_path, JSON.stringify(rows, null, 2), "utf8");

		const counts = rows.reduce<Record<string, number>>((acc, r) => {
			acc[r.verdict] = (acc[r.verdict] ?? 0) + 1;
			return acc;
		}, {});
		console.log(
			`[${page_title}] ${rows.length} word-doc internal link(s) ->`,
			counts,
			`-> ${out_path}`,
		);

		all_mismatches.set(
			page_title,
			rows.filter(
				(r) => r.verdict === "mismatch" || r.verdict === "db_link_missing",
			),
		);
	}

	const md_lines: string[] = [
		"# Zgodovina/Raziskovanje/Varstvo word-doc link mismatches",
		"",
	];
	for (const [page_title, rows] of all_mismatches) {
		if (rows.length === 0) continue;
		md_lines.push(`## ${page_title} (${rows.length})`, "");
		for (const r of rows) {
			md_lines.push(`### "${r.anchor}"`, "");
			md_lines.push(
				`- Word doc says -> **${r.word_doc_target_title ?? "(legacy_id not found in DB)"}** (legacy_id ${r.word_doc_legacy_id})`,
			);
			md_lines.push(
				r.db_href
					? `- DB currently links to -> **${r.db_target_title}** (\`${r.db_href}\`)`
					: `- DB: no matching link found for this anchor text (context below may be from a different mention)`,
			);
			if (r.db_context) md_lines.push(`- Context: ${r.db_context}`);
			md_lines.push("");
		}
	}
	const md_out_path = path.join(OUT_DIR, "mismatches.md");
	await fs.writeFile(md_out_path, md_lines.join("\n"), "utf8");
	console.log(`\nHuman-readable mismatch list -> ${md_out_path}`);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
