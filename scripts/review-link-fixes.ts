import fs from "node:fs/promises";
import { inArray } from "drizzle-orm";
import { chromium } from "playwright";
import { find_primary_slug } from "~/server/article/lifecycle-rules";
import { db } from "~/server/db";
import { Article } from "~/server/db/schema";

const PROPOSAL_DIR = "artifacts/link-fix-proposals";
const CURRENT_ORIGIN = "https://jknm-si.vercel.app";
const LEGACY_ORIGIN = "https://www.jknm.si";

type Proposal = {
	kind: "missing_article_link" | "missing_static_link";
	legacy_id: number;
	article_id: string;
	title: string;
	legacy_href: string;
	expected: string;
	outcome: "ambiguous" | "no_match";
	anchor_text?: string;
	candidate_anchor_texts?: string[];
	match_count?: number;
	target_title?: string;
};

function escape_html(value: string): string {
	return value.replace(
		/[&<>"']/g,
		(character) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
				character
			]!,
	);
}

async function load_proposals(): Promise<Proposal[]> {
	const proposals: Proposal[] = [];
	for (const outcome of ["ambiguous", "no_match"] as const) {
		const file = await fs.readFile(`${PROPOSAL_DIR}/${outcome}.json`, "utf8");
		proposals.push(...(JSON.parse(file) as Proposal[]));
	}
	return proposals;
}

async function main() {
	const proposals = await load_proposals();
	const article_ids = [
		...new Set(proposals.map((proposal) => proposal.article_id)),
	];
	const articles = await db.query.Article.findMany({
		where: inArray(Article.id, article_ids),
		columns: { id: true },
		with: { article_slugs: { columns: { slug: true, is_primary: true } } },
	});
	const slug_by_id = new Map(
		articles.map((article) => [
			article.id,
			find_primary_slug(article.article_slugs)?.slug,
		]),
	);

	const rows = proposals
		.map((proposal, index) => {
			const source_slug = slug_by_id.get(proposal.article_id);
			const current_source = source_slug
				? `${CURRENT_ORIGIN}/novica/${encodeURIComponent(source_slug)}`
				: "";
			const current_target = `${CURRENT_ORIGIN}${proposal.expected}`;
			const legacy_source = `${LEGACY_ORIGIN}/si/?id=${proposal.legacy_id}`;
			const legacy_target = proposal.legacy_href.replace(/^http:/, "https:");
			const anchor =
				proposal.anchor_text ??
				proposal.candidate_anchor_texts?.join(" / ") ??
				"—";
			return `<article class="card" data-index="${index}">
				<div class="meta"><span class="badge">${escape_html(proposal.outcome)}</span> <b>${proposal.kind}</b> · legacy_id ${proposal.legacy_id}</div>
				<h2>${escape_html(proposal.title)}</h2>
				<p><b>Anchor:</b> ${escape_html(anchor)}${proposal.match_count ? ` · ${proposal.match_count} matches` : ""}</p>
				<p><b>Old target:</b> <code>${escape_html(proposal.legacy_href)}</code><br><b>New target:</b> <code>${escape_html(proposal.expected)}</code>${proposal.target_title ? `<br><b>Target title:</b> ${escape_html(proposal.target_title)}` : ""}</p>
				<div class="links">
					<a href="${legacy_source}" target="_blank">Legacy source</a>
					${current_source ? `<a href="${current_source}" target="_blank">Migrated source</a>` : ""}
					<a href="${legacy_target}" target="_blank">Legacy target</a>
					<a href="${current_target}" target="_blank">Migrated target</a>
				</div>
				<div class="decision"><button data-decision="fix">Fix</button><button data-decision="leave">Leave</button><button data-decision="wrong">Wrong target</button><button data-decision="research">Research</button><span></span></div>
				<label class="notes">Notes<textarea rows="2" placeholder="Why this decision?" spellcheck="true"></textarea></label>
			</article>`;
		})
		.join("\n");

	const browser = await chromium.launch({ headless: false });
	const page = await browser.newPage({
		viewport: { width: 1200, height: 900 },
	});
	await page.setContent(`<!doctype html><meta charset="utf-8"><title>JKNM link-fix review</title>
	<style>
		body{font:15px system-ui,sans-serif;max-width:1100px;margin:24px auto;padding:0 18px;background:#f5f5f5;color:#222}.card{background:white;border:1px solid #ddd;border-radius:8px;padding:16px;margin:14px 0}.meta{color:#666}.badge{background:#eee;border-radius:4px;padding:2px 6px;font-size:12px}.links{display:flex;gap:8px;flex-wrap:wrap}.links a,button{border:1px solid #999;border-radius:5px;padding:6px 9px;background:#fff;color:#111;text-decoration:none;cursor:pointer}.links a:hover,button:hover{background:#eef}.decision{display:flex;gap:6px;align-items:center;margin-top:14px}.decision span{color:#176b2c;font-weight:600}.notes{display:block;margin-top:10px;color:#666}.notes textarea{display:block;box-sizing:border-box;width:100%;margin-top:4px;padding:6px;border:1px solid #bbb;border-radius:4px;font:inherit;resize:vertical}code{font-size:12px;word-break:break-all}
	</style><h1>Link-fix review</h1><p>${proposals.length} proposals. Decisions last for this browser session.</p>${rows}
	<script>
		for (const card of document.querySelectorAll('.card')) { for(const button of card.querySelectorAll('button')) button.onclick=()=>{card.querySelector('.decision span').textContent='Selected: '+button.dataset.decision}; }
	</script>`);
	console.log("Review opened in Chromium. Close the browser when finished.");
	await new Promise<void>((resolve) =>
		browser.on("disconnected", () => resolve()),
	);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
