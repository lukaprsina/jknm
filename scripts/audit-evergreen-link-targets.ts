import fs from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { decode } from "html-entities";
import { strip_html_to_text } from "~/lib/sanitize-html";
import { db } from "~/server/db";
import { Article, ArticleSlug } from "~/server/db/schema";

/**
 * The 5 evergreen `content`-kind pages (Klub, Publiciranje, Raziskovanje,
 * Varstvo, Zgodovina) were hand-authored, quoting/summarising past news
 * articles and linking to them via `/novica/<slug>`. `audit-evergreen-pages.ts`
 * only checks that link *shapes* aren't broken (old domain, preview domain,
 * dead self-link, ...) - it can't catch a link that resolves fine but points
 * at the *wrong* article (an anchor jumbled during hand-authoring). Example
 * that prompted this: Zgodovina's "Cvingerska jama" paragraph links 3
 * separate sentences to 3 articles, and at least 2 don't actually match what
 * the sentence describes.
 *
 * For every `/novica/<slug>` link found in these pages, this pairs the
 * surrounding sentence (from the evergreen page itself) with the target
 * article's actual title/date/opening text, so a semantic mismatch is
 * visible without manually re-reading every target article.
 *
 * Report-only. Usage: bun run scripts/audit-evergreen-link-targets.ts
 */

const OUT_DIR = "artifacts/evergreen-link-context";
const NOVICA_LINK_RE = /"?href"?[:=]\\?"(\/novica\/[^"\\?#]+)/gi;

function slugify(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

interface BlockTextRef {
	block_type: string;
	text: string;
}

interface ListItem {
	content?: unknown;
	items?: unknown;
}

function flatten_list_items(items: unknown): string[] {
	if (!Array.isArray(items)) return [];
	const out: string[] = [];
	for (const raw of items as ListItem[]) {
		if (typeof raw.content === "string") out.push(raw.content);
		out.push(...flatten_list_items(raw.items));
	}
	return out;
}

function block_text_refs(content_json: unknown): BlockTextRef[] {
	const blocks = (content_json as { blocks?: unknown[] } | null)?.blocks;
	if (!Array.isArray(blocks)) return [];
	const refs: BlockTextRef[] = [];
	for (const block of blocks) {
		const b = block as { type?: string; data?: unknown };
		const data = b.data as { text?: unknown; items?: unknown } | undefined;
		if (typeof data?.text === "string") {
			refs.push({ block_type: b.type ?? "unknown", text: data.text });
		}
		for (const item_text of flatten_list_items(data?.items)) {
			refs.push({ block_type: `${b.type ?? "unknown"}_item`, text: item_text });
		}
	}
	return refs;
}

function snippet_around(text: string, needle: string, radius = 160): string {
	const at = text.indexOf(needle);
	if (at === -1) return "";
	const start = Math.max(0, at - radius);
	const end = Math.min(text.length, at + needle.length + radius);
	return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

interface LinkContext {
	href: string;
	slug: string;
	context: string;
	target_found: boolean;
	target_title?: string;
	target_published_at?: string | null;
	target_status?: string;
	target_excerpt?: string;
}

async function main() {
	const pages = await db.query.Article.findMany({
		where: and(
			eq(Article.article_kind, "content"),
			eq(Article.status, "published"),
		),
		columns: { id: true, title: true, content_json: true },
	});

	await fs.rm(OUT_DIR, { recursive: true, force: true });
	await fs.mkdir(OUT_DIR, { recursive: true });

	for (const page of pages) {
		if (!page.content_json) continue;
		const raw = JSON.stringify(page.content_json);
		const refs = block_text_refs(page.content_json);

		const hrefs = new Set<string>();
		for (const m of raw.matchAll(NOVICA_LINK_RE)) hrefs.add(m[1]!);

		const results: LinkContext[] = [];
		for (const raw_href of hrefs) {
			const href = decode(raw_href).replace(/&.*$/, "");
			const slug = decodeURIComponent(href.replace(/^\/novica\//, ""));

			// find the block whose plain text contains a link labeled with
			// text near this href - since content_json stores html inline as
			// a string, the cheapest reliable anchor is: which block's raw
			// (un-stripped) text contains this exact href substring.
			const owning_block = refs.find(
				(r) => r.text.includes(raw_href) || r.text.includes(href),
			);
			const needle = owning_block?.text.includes(raw_href) ? raw_href : href;
			const context = owning_block
				? strip_html_to_text(snippet_around(owning_block.text, needle, 300))
				: "";

			const slug_row = await db.query.ArticleSlug.findFirst({
				where: eq(ArticleSlug.slug, slug),
				columns: { article_id: true },
			});
			const target = slug_row
				? await db.query.Article.findFirst({
						where: eq(Article.id, slug_row.article_id),
						columns: {
							title: true,
							published_at: true,
							status: true,
							content_json: true,
						},
					})
				: undefined;

			if (!target) {
				results.push({ href, slug, context, target_found: false });
				continue;
			}

			const target_refs = block_text_refs(target.content_json);
			const excerpt = target_refs
				.filter((r) => r.block_type === "paragraph")
				.map((r) => strip_html_to_text(r.text))
				.find((t) => t.length > 0);

			results.push({
				href,
				slug,
				context,
				target_found: true,
				target_title: target.title,
				target_published_at: target.published_at
					? new Date(target.published_at).toISOString().slice(0, 10)
					: null,
				target_status: target.status,
				target_excerpt: excerpt?.slice(0, 300),
			});
		}

		results.sort((a, b) => a.href.localeCompare(b.href));
		const out_path = path.join(OUT_DIR, `${slugify(page.title)}.json`);
		await fs.writeFile(
			out_path,
			JSON.stringify(
				{ title: page.title, article_id: page.id, links: results },
				null,
				2,
			),
			"utf8",
		);
		console.log(
			`[${page.title}] ${results.length} /novica link(s) -> ${out_path}`,
		);
	}
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
