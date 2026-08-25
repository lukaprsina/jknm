import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { reconcile_media_to_articles } from "~/server/article/reconcile-media";
import { db } from "~/server/db";
import type { ArticleContentType } from "~/server/db/schema";
import { Article } from "~/server/db/schema";
import { authorize_b2, ingest_media_from_url } from "~/server/media/ingest";

/**
 * One-off fixes for the 3 static content-kind pages (Klub, Varstvo,
 * Zgodovina) flagged by `audit-all-discrepancies.ts`'s stray_hotlink check
 * and a manual read of Zgodovina. These pages aren't legacy_id-driven the
 * same way news articles are (hand-rewritten by the admin), so there's no
 * findings JSON to consume — the target list here is hardcoded from a direct
 * read of each page's current content_json.
 *
 * Two kinds of fix, both by exact literal href match in the serialized
 * content_json (like fix-wrong-article-media.ts):
 *  - `rewrite`: replace a dead href with a fixed one, no ingest (Klub's
 *    `http:///` self-link — editorjs's link tool mangles a bare "/", see
 *    vendor/editorjs's addProtocol, so the target is the absolute canonical
 *    url instead).
 *  - `ingest`: fetch `media_url` into `gradivo.jknm.org` via
 *    `ingest_media_from_url`, then rewrite `old_href` to the new media url.
 *    `old_href` and `media_url` differ for the 8 Zgodovina links (an old
 *    `/si/publikacije/krasNN/` landing page vs. the actual
 *    `/media/DK/Dolenjski_kras_N.pdf` it links to) and are identical for the
 *    21 Varstvo links (already direct PDF links, just never ingested).
 *
 * Usage:
 *   bun run scripts/fix-static-page-links.ts             # dry run
 *   bun run scripts/fix-static-page-links.ts --execute
 */

interface RewriteFix {
	kind: "rewrite";
	title: string;
	old_href: string;
	new_href: string;
}

interface IngestFix {
	kind: "ingest";
	title: string;
	old_href: string;
	media_url: string;
}

type Fix = RewriteFix | IngestFix;

const FIXES: Fix[] = [
	...[1, 2, 3, 4, 5, 6, 7, 8].map(
		(n): IngestFix => ({
			kind: "ingest",
			title: "Zgodovina",
			old_href: `http${n === 1 ? "" : "s"}://www.jknm.si/si/publikacije/kras0${n}/`,
			media_url: `https://www.jknm.si/media/DK/Dolenjski_kras_${n}.pdf`,
		}),
	),
	...[
		"https://www.jknm.si/media/DK/DK8_22_Prsina_Po_suhi_dolini_v_Packi_dol.pdf",
		"https://www.jknm.si/media/DK/DK8_34_Bucar_Pregled_ciscenja_jam_2018___2021.pdf",
		"https://www.jknm.si/media/DK/DK8_35_Ticar_Onesnazenost_jam_na_Dolenjskem.pdf",
		"https://www.jknm.si/media/DK/DK8_36_Janezic_Brezno_3_pri_grobiscu___sanitarni_iznos.pdf",
		"https://www.jknm.si/media/DK/DK8_37_Bucar_Brezno_3_pri_grobiscu___tehnicna_izvedba.pdf",
		"http://www.jknm.si/media/DK/DK7_22_Bukovec_Novakova_jama.pdf",
		"https://www.jknm.si/media/DK/DK7_23_Prsina_Razkrita_skrivnost_jame_na_Cvingerju.pdf",
		"https://www.jknm.si/media/DK/DK7_26_Bukovec_Misnica.pdf",
		"https://www.jknm.si/media/DK/DK7_27_Bucar_LIFE_Kocevsko.pdf",
		"https://www.jknm.si/media/DK/DK6_32_Ladisic_Onesnazene_jame.pdf",
		"https://www.jknm.si/media/DK/DK6_33_Tomsic_Jama_Grc_vrh_3_je_ociscena.pdf",
		"https://www.jknm.si/media/DK/DK5_07_Tomsic_Ciscenje_onesnazenih_jam.pdf",
		"https://www.jknm.si/media/DK/DK4_26_Hudoklin_Onesnazenost_jam_v_MO_Novo_mesto.pdf",
		"https://www.jknm.si/media/DK/DK4_27_Gasperic_Ciscenje_Pristavske_jame.pdf",
		"https://www.jknm.si/media/DK/DK4_28_Bucar_Ciscenje_Shornice.pdf",
		"https://www.jknm.si/media/pdf/Bilten_95_Hudoklin_Kotarjeva.pdf",
		"https://www.jknm.si/media/pdf/NJ_37_Hudoklin_Onesnazenost.pdf",
		"https://www.jknm.si/media/pdf/Bilten_90_Hudoklin_Trilogija.pdf",
		"https://www.jknm.si/media/pdf/NJ_31_Klepec_Onesnazene.pdf",
		"https://www.jknm.si/media/DK/DK2_06_Hudoklin_Onesnazene_jame_v_obcinah_Novo_mesto_in_Trebnje.pdf",
		"https://www.jknm.si/media/DK/DK1_12_Habe_Onesnazevanje_jam_dolenjskega_krasa.pdf",
	].map(
		(url): IngestFix => ({
			kind: "ingest",
			title: "Varstvo",
			old_href: url,
			media_url: url,
		}),
	),
];

async function main() {
	const { values } = parseArgs({ options: { execute: { type: "boolean" } } });
	const execute = values.execute ?? false;

	const b2 = execute ? await authorize_b2() : null;

	const by_title = new Map<string, Fix[]>();
	for (const fix of FIXES) {
		by_title.set(fix.title, [...(by_title.get(fix.title) ?? []), fix]);
	}

	let fixed = 0;
	let missing = 0;
	let ingest_failed = 0;

	for (const [title, fixes] of by_title) {
		const article = await db.query.Article.findFirst({
			where: (t, { and, eq: eq_ }) =>
				and(
					eq_(t.title, title),
					eq_(t.article_kind, "content"),
					eq_(t.status, "published"),
				),
			columns: { id: true, content_json: true },
		});
		if (!article?.content_json) {
			console.warn(
				`[${title}] article not found — skipping ${fixes.length} fix(es)`,
			);
			missing += fixes.length;
			continue;
		}

		let text = JSON.stringify(article.content_json);
		let changed = false;

		for (const fix of fixes) {
			if (!text.includes(fix.old_href)) {
				console.warn(
					`[${title}] href not found, already fixed?: ${fix.old_href}`,
				);
				missing += 1;
				continue;
			}

			let new_href: string;
			if (fix.kind === "rewrite") {
				new_href = fix.new_href;
			} else {
				if (!execute) {
					console.log(`[${title}] would ingest ${fix.media_url}`);
					fixed += 1;
					continue;
				}
				if (!b2)
					throw new Error("unreachable: execute implies b2 was authorized");
				const media = await db.transaction((tx) =>
					ingest_media_from_url(fix.media_url, { tx, b2 }),
				);
				if (!media) {
					console.warn(`[${title}] ingest failed for ${fix.media_url}`);
					ingest_failed += 1;
					continue;
				}
				new_href = media.original.url;
			}

			console.log(`[${title}] ${fix.old_href} -> ${new_href}`);
			text = text.split(fix.old_href).join(new_href);
			changed = true;
			fixed += 1;
		}

		if (changed && execute) {
			const content = JSON.parse(text) as ArticleContentType;
			await db.transaction(async (tx) => {
				await tx
					.update(Article)
					.set({ content_json: content })
					.where(eq(Article.id, article.id));
				await reconcile_media_to_articles(tx, article.id, content);
			});
		}
	}

	console.log(
		`\n${fixed} fixed, ${missing} not found (already fixed?), ${ingest_failed} ingest failure(s).`,
	);
	if (!execute) {
		console.log(
			"\nDry run only — re-run with --execute to ingest + rewrite + reconcile.",
		);
	}
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
