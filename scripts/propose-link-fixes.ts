import fs from "node:fs/promises";
import path from "node:path";
import { parse as parse_csv } from "csv-parse/sync";
import { inArray } from "drizzle-orm";
import { parse as parse_html } from "node-html-parser";
import { strip_html_to_text } from "~/lib/sanitize-html";
import { db } from "~/server/db";
import { Article } from "~/server/db/schema";

/**
 * For each `missing_article_link` / `missing_static_link` finding from
 * `legacy-link-diff.ts` (target URL already resolved deterministically —
 * see that script), tries to locate *where* to insert the link: the legacy
 * anchor's own text, searched for verbatim inside the target article's
 * current `content_json` blocks. If that text shows up in exactly one spot,
 * the insertion point is unambiguous and gets proposed for review.
 *
 * Doesn't touch `missing_external_link` — those need a "restore this dead
 * external target or drop it" judgment call, not a location to place a link
 * that's already been dropped.
 *
 * Report-only, like `legacy-link-diff.ts` itself: writes proposals to
 * artifacts/link-fix-proposals/, doesn't edit any article. A separate apply
 * script (once this has been eyeballed) is the next step, same
 * find-then-fix split as `fix-wrong-article-media.ts`.
 *
 * Usage: bun run scripts/propose-link-fixes.ts
 */

const CSV_PATH = "artifacts/Objave.txt";
const HTML_DIR = "artifacts/legacy-html";
const LINK_DIFF_DIR = "artifacts/link-diff";
const OUT_DIR = "artifacts/link-fix-proposals";

interface Finding {
	kind: "missing_article_link" | "missing_static_link";
	legacy_id: number;
	article_id: string;
	title: string;
	legacy_href: string;
	expected: string;
}

async function load_csv_bodies(): Promise<Map<number, string>> {
	const text = await fs.readFile(CSV_PATH, "utf8");
	const records: string[][] = parse_csv(text, {
		columns: false,
		relax_column_count: true,
	});
	const bodies = new Map<number, string>();
	for (const record of records) {
		const legacy_id = Number(record[0]);
		if (!Number.isFinite(legacy_id)) continue;
		const body_html = (record[6] ?? "").trim();
		if (!body_html) continue;
		bodies.set(legacy_id, body_html);
	}
	return bodies;
}

async function load_html_bodies(): Promise<Map<number, string>> {
	const bodies = new Map<number, string>();
	let files: string[];
	try {
		files = await fs.readdir(HTML_DIR);
	} catch {
		return bodies;
	}
	for (const file of files) {
		const legacy_id = Number(file.replace(/\.html$/, ""));
		if (!Number.isFinite(legacy_id)) continue;
		const page_html = await fs.readFile(path.join(HTML_DIR, file), "utf8");
		const root = parse_html(page_html);
		const container = root.querySelector("h1")?.parentNode;
		if (!container) continue;
		bodies.set(legacy_id, container.innerHTML);
	}
	return bodies;
}

function anchor_texts_for_href(
	body_html: string,
	legacy_href: string,
): string[] {
	const root = parse_html(body_html);
	const texts = new Set<string>();
	for (const a of root.querySelectorAll("a")) {
		if (a.getAttribute("href") !== legacy_href) continue;
		const text = a.text.trim();
		if (text.length > 0) texts.add(text);
	}
	return [...texts];
}

interface BlockTextRef {
	block_index: number;
	block_id?: string;
	block_type: string;
	text: string;
}

function block_text_refs(content_json: unknown): BlockTextRef[] {
	const blocks = (content_json as { blocks?: unknown[] } | null)?.blocks;
	if (!Array.isArray(blocks)) return [];
	const refs: BlockTextRef[] = [];
	blocks.forEach((block, index) => {
		const b = block as { id?: string; type?: string; data?: unknown };
		const text = (b.data as { text?: unknown } | undefined)?.text;
		if (typeof text !== "string") return;
		refs.push({
			block_index: index,
			block_id: b.id,
			block_type: b.type ?? "unknown",
			text,
		});
	});
	return refs;
}

function snippet_around(text: string, needle: string, radius = 120): string {
	const at = text.indexOf(needle);
	if (at === -1) return "";
	const start = Math.max(0, at - radius);
	const end = Math.min(text.length, at + needle.length + radius);
	return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

// The target article's title is the cheapest sanity check available: does it
// actually match what the anchor text/surrounding sentence is talking about?
// Re-derives the target legacy_id straight from the `id=` query param on the
// legacy href — same value legacy-link-diff.ts already parsed to compute
// `expected`, just not carried through into the finding JSON.
function target_legacy_id(legacy_href: string): number | undefined {
	const match = /[?&]id=(\d+)/.exec(legacy_href);
	if (!match?.[1]) return undefined;
	const id = Number(match[1]);
	return Number.isFinite(id) ? id : undefined;
}

type Proposal =
	| (Finding & {
			outcome: "unique_match";
			anchor_text: string;
			target_title?: string;
			legacy_context: string;
			block_index: number;
			block_id?: string;
			block_type: string;
			snippet: string;
	  })
	| (Finding & {
			outcome: "ambiguous";
			anchor_text: string;
			target_title?: string;
			match_count: number;
	  })
	| (Finding & { outcome: "no_match"; candidate_anchor_texts: string[] });

async function main() {
	const csv_bodies = await load_csv_bodies();
	const html_bodies = await load_html_bodies();
	const legacy_bodies = new Map<number, string>(csv_bodies);
	for (const [id, body] of html_bodies) {
		if (!legacy_bodies.has(id)) legacy_bodies.set(id, body);
	}

	const findings: Finding[] = [];
	for (const kind of ["missing_article_link", "missing_static_link"] as const) {
		const file_path = path.join(LINK_DIFF_DIR, `${kind}.json`);
		try {
			const rows = JSON.parse(
				await fs.readFile(file_path, "utf8"),
			) as Finding[];
			findings.push(...rows);
		} catch {
			console.warn(`No ${file_path} — run legacy-link-diff.ts first.`);
		}
	}
	console.log(`Loaded ${findings.length} finding(s) to try to place.`);

	const article_ids = [...new Set(findings.map((f) => f.article_id))];
	const articles = await db.query.Article.findMany({
		where: inArray(Article.id, article_ids),
		columns: { id: true, content_json: true },
	});
	const content_by_article = new Map(
		articles.map((a) => [a.id, block_text_refs(a.content_json)]),
	);

	const target_legacy_ids = [
		...new Set(
			findings
				.filter((f) => f.kind === "missing_article_link")
				.map((f) => target_legacy_id(f.legacy_href))
				.filter((id): id is number => id !== undefined),
		),
	];
	const target_articles = target_legacy_ids.length
		? await db.query.Article.findMany({
				where: inArray(Article.legacy_id, target_legacy_ids),
				columns: { legacy_id: true, title: true },
			})
		: [];
	const title_by_target_legacy_id = new Map(
		target_articles.map((a) => [a.legacy_id, a.title]),
	);

	const proposals: Proposal[] = [];
	for (const finding of findings) {
		const legacy_body = legacy_bodies.get(finding.legacy_id);
		const candidates = legacy_body
			? anchor_texts_for_href(legacy_body, finding.legacy_href)
			: [];
		const refs = content_by_article.get(finding.article_id) ?? [];
		const target_title =
			finding.kind === "missing_article_link"
				? title_by_target_legacy_id.get(
						target_legacy_id(finding.legacy_href) ?? -1,
					)
				: undefined;

		let placed = false;
		for (const anchor_text of candidates) {
			const matches = refs.flatMap((ref) => {
				const count = ref.text.split(anchor_text).length - 1;
				return count > 0 ? (Array(count).fill(ref) as BlockTextRef[]) : [];
			});
			if (matches.length === 1) {
				const ref = matches[0]!;
				proposals.push({
					...finding,
					outcome: "unique_match",
					anchor_text,
					target_title,
					legacy_context: legacy_body
						? snippet_around(strip_html_to_text(legacy_body), anchor_text)
						: "",
					block_index: ref.block_index,
					block_id: ref.block_id,
					block_type: ref.block_type,
					snippet: snippet_around(ref.text, anchor_text),
				});
				placed = true;
				break;
			}
			if (matches.length > 1) {
				proposals.push({
					...finding,
					outcome: "ambiguous",
					anchor_text,
					target_title,
					match_count: matches.length,
				});
				placed = true;
				break;
			}
		}
		if (!placed) {
			proposals.push({
				...finding,
				outcome: "no_match",
				candidate_anchor_texts: candidates,
			});
		}
	}

	const by_outcome = new Map<string, Proposal[]>();
	for (const p of proposals) {
		by_outcome.set(p.outcome, [...(by_outcome.get(p.outcome) ?? []), p]);
	}

	console.log("\nOutcome counts:");
	for (const [outcome, rows] of [...by_outcome].sort()) {
		console.log(`  ${outcome}: ${rows.length}`);
	}

	await fs.rm(OUT_DIR, { recursive: true, force: true });
	await fs.mkdir(OUT_DIR, { recursive: true });
	for (const [outcome, rows] of by_outcome) {
		const out_path = path.join(OUT_DIR, `${outcome}.json`);
		await fs.writeFile(out_path, JSON.stringify(rows, null, 2), "utf8");
	}
	console.log(`\nWritten ${by_outcome.size} file(s) to ${OUT_DIR}/`);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
