import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { extract_media_refs_from_content } from "~/lib/editor-utils";
import { MEDIA_PUBLIC_DOMAIN } from "~/lib/media-upload";
import { find_stale_asset_urls } from "~/lib/stale-media-refs";
import { db } from "~/server/db";
import { Article } from "~/server/db/schema";

/**
 * Report-only audit of the 5 evergreen `article_kind: "content"` pages
 * (Klub, Publiciranje, Raziskovanje, Varstvo, Zgodovina). These were
 * hand-rebuilt, not migrated from a legacy source (CONTEXT.md,
 * docs/architecture.md), so `legacy-link-diff.ts`/`legacy-media-hash-diff.ts`
 * don't apply — there's no legacy body to diff against. This checks the
 * *current* `content_json` for shapes that are always wrong regardless of
 * provenance:
 *
 *  - `old_domain_link`: an absolute `jknm.si`/`www.jknm.si` link (old site is
 *    gone; internal targets should be relative `/novica/<slug>` or the fixed
 *    static routes, external mentions should be dropped or repointed).
 *  - `preview_domain_link`: an absolute link onto a `*.vercel.app` preview
 *    deployment (e.g. `jknm-si.vercel.app`) baked into published content -
 *    a leftover from copy/testing against a preview URL instead of a
 *    relative path or the production domain.
 *  - `legacy_id_query_link`: an internal link using the old `?id=<legacy_id>`
 *    article-lookup form (`/novica/?id=`, `/si/?id=`, or bare `?id=`) instead
 *    of `/novica/<slug>`.
 *  - `dead_self_link`: `href="http:///"` - the exact dead url editorjs's core
 *    Link tool's `addProtocol` used to produce for a bare `/` self-link
 *    (fixed for future edits by the `@editorjs/editorjs` bun patch, but
 *    already-saved content from before the patch can still carry it).
 *  - `vsebina_link`: a link onto `vsebina.jknm.org` - the untracked
 *    static-page dehotlinking bucket (no `Media` row). Same pattern as the
 *    659/663/664 article fix: worth moving onto `gradivo.jknm.org` if a
 *    `Media` row for the same bytes already exists.
 *  - `non_gradivo_media`: an image/attaches block whose file url isn't on
 *    `gradivo.jknm.org` - the only tracked-media host; anything else has no
 *    `Media` row and won't survive `sweep-stale-content.ts` or the
 *    responsive-variant pipeline.
 *  - `stale_asset_host`: a link/media url on one of the two known-dead
 *    storage hosts (`stale-media-refs.ts`).
 *
 * Also dumps every hyperlink found in these pages (not just flagged ones) to
 * `artifacts/evergreen-links/`, one file per page, for manual review.
 *
 * Usage: bun run scripts/audit-evergreen-pages.ts
 */

const OUT_DIR = "artifacts/evergreen-page-audit";
const LINKS_OUT_DIR = "artifacts/evergreen-links";

interface OldDomainLink {
	kind: "old_domain_link";
	title: string;
	article_id: string;
	url: string;
	occurrences: number;
}

interface PreviewDomainLink {
	kind: "preview_domain_link";
	title: string;
	article_id: string;
	url: string;
	occurrences: number;
}

interface LegacyIdQueryLink {
	kind: "legacy_id_query_link";
	title: string;
	article_id: string;
	href: string;
	occurrences: number;
}

interface DeadSelfLink {
	kind: "dead_self_link";
	title: string;
	article_id: string;
	occurrences: number;
}

interface VsebinaLink {
	kind: "vsebina_link";
	title: string;
	article_id: string;
	url: string;
	occurrences: number;
}

interface NonGradivoMedia {
	kind: "non_gradivo_media";
	title: string;
	article_id: string;
	block_type: string;
	url: string;
}

interface StaleAssetHost {
	kind: "stale_asset_host";
	title: string;
	article_id: string;
	url: string;
}

type Finding =
	| OldDomainLink
	| PreviewDomainLink
	| LegacyIdQueryLink
	| DeadSelfLink
	| VsebinaLink
	| NonGradivoMedia
	| StaleAssetHost;

const OLD_DOMAIN_RE = /https?:\/\/(?:www\.)?jknm\.si[^\s"'<>)\\]*/gi;
const PREVIEW_DOMAIN_RE = /https?:\/\/[^\s"'<>)\\]*\.vercel\.app[^\s"'<>)\\]*/gi;
const VSEBINA_LINK_RE = /https?:\/\/vsebina\.jknm\.org[^\s"'<>)\\]*/gi;
// `href` shows up two ways once content_json is JSON.stringify'd: as a real
// object property (`"href":"value"`, from tools that store links as data,
// e.g. inline-file-link-tool) or, far more often, inside inline HTML stored
// as a string value, where JSON's own quote-escaping turns `href="value"`
// into `href=\"value\"`. Matching both keeps this from silently missing the
// HTML case, which produced 0 false-negative findings until the link dump
// below exposed it.
const HREF_RE = /"?href"?[:=]\\?"([^"\\]*)/gi;
const LEGACY_ID_QUERY_RE = new RegExp(
	String.raw`"?href"?[:=]\\?"([^"\\]*\?[^"\\]*\bid=\d+[^"\\]*)`,
	"gi",
);
const DEAD_SELF_LINK_RE = /"?href"?[:=]\\?"http:\/\/\/\\?"/gi;

function count_matches(text: string, re: RegExp): Map<string, number> {
	const counts = new Map<string, number>();
	for (const m of text.matchAll(re)) {
		const key = m[1] ?? m[0];
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return counts;
}

function slugify(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

async function main() {
	const articles = await db.query.Article.findMany({
		where: eq(Article.article_kind, "content"),
		columns: { id: true, title: true, status: true, content_json: true },
	});

	const live = articles.filter((a) => a.status !== "deleted");
	console.log(
		`Found ${articles.length} content-kind row(s), ${live.length} non-deleted (checking those).`,
	);

	const findings: Finding[] = [];

	await fs.rm(LINKS_OUT_DIR, { recursive: true, force: true });
	await fs.mkdir(LINKS_OUT_DIR, { recursive: true });

	for (const article of live) {
		if (!article.content_json) continue;
		const raw = JSON.stringify(article.content_json);

		for (const [url, occurrences] of count_matches(raw, OLD_DOMAIN_RE)) {
			findings.push({
				kind: "old_domain_link",
				title: article.title,
				article_id: article.id,
				url,
				occurrences,
			});
		}

		for (const [url, occurrences] of count_matches(raw, PREVIEW_DOMAIN_RE)) {
			findings.push({
				kind: "preview_domain_link",
				title: article.title,
				article_id: article.id,
				url,
				occurrences,
			});
		}

		for (const [href, occurrences] of count_matches(raw, LEGACY_ID_QUERY_RE)) {
			findings.push({
				kind: "legacy_id_query_link",
				title: article.title,
				article_id: article.id,
				href,
				occurrences,
			});
		}

		const dead_self_count = [...raw.matchAll(DEAD_SELF_LINK_RE)].length;
		if (dead_self_count > 0) {
			findings.push({
				kind: "dead_self_link",
				title: article.title,
				article_id: article.id,
				occurrences: dead_self_count,
			});
		}

		for (const [url, occurrences] of count_matches(raw, VSEBINA_LINK_RE)) {
			findings.push({
				kind: "vsebina_link",
				title: article.title,
				article_id: article.id,
				url,
				occurrences,
			});
		}

		for (const ref of extract_media_refs_from_content(article.content_json)) {
			const url = ref.data.file?.url;
			if (!url) continue;
			let host: string;
			try {
				host = new URL(url).hostname;
			} catch {
				host = "";
			}
			if (host !== MEDIA_PUBLIC_DOMAIN) {
				findings.push({
					kind: "non_gradivo_media",
					title: article.title,
					article_id: article.id,
					block_type: ref.type,
					url,
				});
			}
		}

		for (const url of find_stale_asset_urls(raw)) {
			findings.push({
				kind: "stale_asset_host",
				title: article.title,
				article_id: article.id,
				url,
			});
		}

		const links = [...count_matches(raw, HREF_RE)]
			.map(([href, occurrences]) => ({ href, occurrences }))
			.sort((a, b) => a.href.localeCompare(b.href));
		const links_out_path = path.join(
			LINKS_OUT_DIR,
			`${slugify(article.title)}.json`,
		);
		await fs.writeFile(
			links_out_path,
			JSON.stringify(
				{ title: article.title, article_id: article.id, links },
				null,
				2,
			),
			"utf8",
		);
	}

	const by_kind = new Map<string, number>();
	for (const f of findings) by_kind.set(f.kind, (by_kind.get(f.kind) ?? 0) + 1);

	console.log("\nFinding counts:");
	for (const [kind, count] of [...by_kind].sort()) {
		console.log(`  ${kind}: ${count}`);
	}
	console.log(`\nTotal: ${findings.length}`);

	await fs.rm(OUT_DIR, { recursive: true, force: true });
	await fs.mkdir(OUT_DIR, { recursive: true });
	const by_kind_rows = new Map<string, Finding[]>();
	for (const f of findings) {
		by_kind_rows.set(f.kind, [...(by_kind_rows.get(f.kind) ?? []), f]);
	}
	for (const [kind, rows] of by_kind_rows) {
		const out_path = path.join(OUT_DIR, `${kind}.json`);
		await fs.writeFile(out_path, JSON.stringify(rows, null, 2), "utf8");
	}
	console.log(`\nWritten ${by_kind_rows.size} file(s) to ${OUT_DIR}/`);
	console.log(`Written ${live.length} link dump(s) to ${LINKS_OUT_DIR}/`);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
