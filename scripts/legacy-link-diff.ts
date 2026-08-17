import fs from "node:fs/promises";
import path from "node:path";
import { parse as parse_csv } from "csv-parse/sync";
import { parse as parse_html } from "node-html-parser";
import { is_waived, load_waivers } from "~/lib/legacy-diff-waivers";
import { resolve_legacy_static_path } from "~/lib/legacy-si-paths";
import { find_primary_slug } from "~/server/article/lifecycle-rules";
import { db } from "~/server/db";

/**
 * Report-only diff between the hyperlinks a legacy article actually carried
 * (scraped `www.jknm.si` content, ids 1-691) and the links currently present
 * in its migrated `Article.content_json` — flags links that look dropped
 * during migration, distinct from `audit-all-discrepancies.ts`'s
 * `stray_hotlink` check (which flags the opposite: old-domain links left
 * *in*).
 *
 * Deliberately doesn't diff `/media/...` PDF links: which file bytes ended
 * up where is a hash/identity question, not a hyperlink-target one — that's
 * `unrecovered-legacy-media.md` / the still-unbuilt media-hash-diff script's
 * job (see the `wayfinder:map` issue "Verify legacy jknm.si links and media
 * against the new site"). A legacy PDF href also can't be matched by
 * filename post-migration: `ingest_media` content-addresses uploads under a
 * new UUID, so the original filename isn't preserved anywhere to match on.
 *
 * Legacy body HTML comes from two sources depending on which one covers a
 * given `legacy_id` (see `audit-all-discrepancies.ts`'s `load_csv_rows` /
 * `load_html_rows`): `Objave.txt`'s 7th column (already an isolated
 * `<p>`-tag body fragment) for ids it covers, or `artifacts/legacy-html/
 * <id>.html`'s `<h1>`'s parent container (same extraction as the static-page
 * migration, `scripts/migrate/html-to-blocks.ts`) for the rest.
 *
 * Articles only — the 5 evergreen content pages were rebuilt from scratch
 * rather than migrated, confirmed correct, and have no legacy body to diff
 * against anyway (the `served` mirror's `si/<section>/default.asp` files
 * turned out to be empty ASP redirect stubs, not saved static HTML).
 *
 * Output is one JSON file per finding kind under artifacts/link-diff/, same
 * split-by-kind convention as audit-all-discrepancies.ts — minus whatever
 * artifacts/link-diff-waivers.jsonc has marked as deliberately ignored (see
 * src/lib/legacy-diff-waivers.ts).
 *
 * Usage: bun run scripts/legacy-link-diff.ts
 */

const CSV_PATH = "artifacts/Objave.txt";
const HTML_DIR = "artifacts/legacy-html";
const OUT_DIR = "artifacts/link-diff";
const WAIVERS_PATH = "artifacts/link-diff-waivers.jsonc";
const LAST_REAL_LEGACY_ID = 691;

interface LegacyBody {
	legacy_id: number;
	body_html: string;
	source: "csv" | "html";
}

async function load_csv_bodies(): Promise<Map<number, LegacyBody>> {
	const text = await fs.readFile(CSV_PATH, "utf8");
	const records: string[][] = parse_csv(text, {
		columns: false,
		relax_column_count: true,
	});

	const bodies = new Map<number, LegacyBody>();
	for (const record of records) {
		const legacy_id = Number(record[0]);
		if (!Number.isFinite(legacy_id)) continue;
		const body_html = (record[6] ?? "").trim();
		if (!body_html) continue;
		bodies.set(legacy_id, { legacy_id, body_html, source: "csv" });
	}
	return bodies;
}

async function load_html_bodies(): Promise<Map<number, LegacyBody>> {
	const bodies = new Map<number, LegacyBody>();
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
		const h1 = root.querySelector("h1");
		const container = h1?.parentNode;
		if (!container) continue;

		bodies.set(legacy_id, {
			legacy_id,
			body_html: container.innerHTML,
			source: "html",
		});
	}
	return bodies;
}

// --- classification ------------------------------------------------------

type Classification =
	| { kind: "article"; legacy_id: number }
	| { kind: "static"; segments: string[] }
	| { kind: "media" }
	| { kind: "bare_domain" }
	| { kind: "external"; href: string };

function classify_legacy_href(raw_href: string): Classification | null {
	let url: URL;
	try {
		url = new URL(raw_href, "https://www.jknm.si");
	} catch {
		return null; // e.g. "javascript:void(...)"
	}

	if (!/jknm\.si$/i.test(url.hostname)) {
		return { kind: "external", href: raw_href };
	}

	const id_param = url.searchParams.get("id");
	if (url.pathname === "/si/" && id_param) {
		const legacy_id = Number(id_param);
		if (Number.isFinite(legacy_id)) return { kind: "article", legacy_id };
	}

	if (url.pathname.startsWith("/media/")) return { kind: "media" };

	if (url.pathname.startsWith("/si/")) {
		const segments = url.pathname
			.replace(/^\/si\//, "")
			.split("/")
			.filter(Boolean);
		if (segments.length > 0) return { kind: "static", segments };
	}

	return { kind: "bare_domain" };
}

interface MissingLink {
	kind:
		| "missing_article_link"
		| "missing_static_link"
		| "missing_external_link";
	legacy_id: number;
	article_id: string;
	title: string;
	legacy_href: string;
	expected: string;
}

function extract_hrefs(body_html: string): string[] {
	const root = parse_html(body_html);
	return root
		.querySelectorAll("a")
		.map((a) => a.getAttribute("href"))
		.filter((href): href is string => !!href);
}

function extract_our_hrefs(content_json: unknown): Set<string> {
	const raw = JSON.stringify(content_json).replace(/\\"/g, '"');
	const hrefs = new Set<string>();
	for (const match of raw.matchAll(/href="([^"]+)"/g)) {
		const href = match[1];
		if (href) hrefs.add(href);
	}
	return hrefs;
}

function normalize(href: string): string {
	return href.trim().replace(/\/$/, "").toLowerCase();
}

function present(hrefs: Set<string>, target: string): boolean {
	const wanted = normalize(target);
	for (const href of hrefs) {
		if (normalize(href).includes(wanted) || wanted.includes(normalize(href))) {
			return true;
		}
	}
	return false;
}

async function main() {
	const waivers = await load_waivers(WAIVERS_PATH);

	const csv_bodies = await load_csv_bodies();
	const html_bodies = await load_html_bodies();
	const legacy_bodies = new Map<number, LegacyBody>(csv_bodies);
	for (const [id, body] of html_bodies) {
		if (!legacy_bodies.has(id)) legacy_bodies.set(id, body);
	}
	console.log(
		`Loaded ${csv_bodies.size} CSV body(s) + ${html_bodies.size} HTML body(s) (${legacy_bodies.size} distinct legacy ids).`,
	);

	const articles = await db.query.Article.findMany({
		columns: { id: true, legacy_id: true, title: true, content_json: true },
		with: { article_slugs: { columns: { slug: true, is_primary: true } } },
	});
	const by_legacy_id = new Map(
		articles
			.filter((a) => a.legacy_id !== null)
			.map((a) => [a.legacy_id as number, a]),
	);

	const findings: MissingLink[] = [];
	let checked = 0;
	let legacy_links_seen = 0;

	for (const article of articles) {
		if (article.legacy_id === null) continue;
		if (article.legacy_id > LAST_REAL_LEGACY_ID) continue;
		const legacy = legacy_bodies.get(article.legacy_id);
		if (!legacy || !article.content_json) continue;

		checked += 1;
		const legacy_hrefs = extract_hrefs(legacy.body_html);
		const our_hrefs = extract_our_hrefs(article.content_json);

		for (const legacy_href of legacy_hrefs) {
			const classification = classify_legacy_href(legacy_href);
			if (!classification) continue;
			legacy_links_seen += 1;

			if (
				classification.kind === "media" ||
				classification.kind === "bare_domain"
			) {
				continue;
			}

			if (classification.kind === "external") {
				if (!present(our_hrefs, classification.href)) {
					findings.push({
						kind: "missing_external_link",
						legacy_id: article.legacy_id,
						article_id: article.id,
						title: article.title,
						legacy_href,
						expected: classification.href,
					});
				}
				continue;
			}

			if (classification.kind === "article") {
				const target = by_legacy_id.get(classification.legacy_id);
				const primary = target
					? find_primary_slug(target.article_slugs)
					: undefined;
				if (!primary) continue; // dangling legacy_id ref — a different check's job
				const expected = `/novica/${primary.slug}`;
				if (!present(our_hrefs, expected)) {
					findings.push({
						kind: "missing_article_link",
						legacy_id: article.legacy_id,
						article_id: article.id,
						title: article.title,
						legacy_href,
						expected,
					});
				}
				continue;
			}

			if (classification.kind === "static") {
				const resolution = resolve_legacy_static_path(classification.segments);
				if (resolution.outcome === "gone") continue; // intentionally unmigrated, see legacy-si-paths.ts
				if (!present(our_hrefs, resolution.path)) {
					findings.push({
						kind: "missing_static_link",
						legacy_id: article.legacy_id,
						article_id: article.id,
						title: article.title,
						legacy_href,
						expected: resolution.path,
					});
				}
			}
		}
	}

	const kept = findings.filter(
		(f) =>
			!is_waived(waivers, {
				legacy_id: f.legacy_id,
				kind: f.kind,
				legacy_url: f.legacy_href,
			}),
	);
	const waived_count = findings.length - kept.length;

	const by_kind = new Map<string, number>();
	for (const f of kept) by_kind.set(f.kind, (by_kind.get(f.kind) ?? 0) + 1);

	console.log(
		`\nChecked ${checked} article(s), ${legacy_links_seen} legacy link(s) seen.`,
	);
	console.log("Finding counts:");
	for (const [kind, count] of [...by_kind].sort()) {
		console.log(`  ${kind}: ${count}`);
	}
	console.log(`\nTotal: ${kept.length} (${waived_count} waived)`);

	await fs.rm(OUT_DIR, { recursive: true, force: true });
	await fs.mkdir(OUT_DIR, { recursive: true });
	const by_kind_rows = new Map<string, MissingLink[]>();
	for (const f of kept) {
		by_kind_rows.set(f.kind, [...(by_kind_rows.get(f.kind) ?? []), f]);
	}
	for (const [kind, rows] of by_kind_rows) {
		const out_path = path.join(OUT_DIR, `${kind}.json`);
		await fs.writeFile(out_path, JSON.stringify(rows, null, 2), "utf8");
	}
	console.log(`\nWritten ${by_kind_rows.size} file(s) to ${OUT_DIR}/`);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
