import { parseArgs } from "node:util";
import B2 from "b2-js";
import { eq } from "drizzle-orm";
import mime from "mime/lite";
import { env } from "~/env";
import {
	find_legacy_id_refs,
	find_pdf_refs,
	static_asset_key,
} from "~/lib/dehotlink-static-refs";
import { resolve_legacy_article_link } from "~/lib/resolve-legacy-article-link";
import { resolve_pdf_bytes } from "~/lib/resolve-static-pdf";
import { static_content_url } from "~/lib/static-content-upload";
import { db } from "~/server/db";
import type { ArticleContentType } from "~/server/db/schema";
import { Article } from "~/server/db/schema";

/**
 * Article-content counterpart to `scripts/dehotlink-static-pages.ts` — same
 * two link shapes (`/media/...pdf` and `/si/?id=<legacy_id>`), same
 * resolvers (`resolve_pdf_bytes`, `resolve_legacy_article_link`), just a
 * different source (`Article.content_json`, EditorJS JSON) and sink (a db
 * write instead of a file write). Per `scripts/audit-article-hotlinks.ts`
 * this is 19 of the 46 remaining `www.jknm.si` refs — the other 27
 * (static-page-link: impresum, izobraževanje, publikacije/kras0N, jame/naj,
 * raziskovanje/grmec) point at pages that were never migrated and are left
 * alone, tracked in TODO.md.
 *
 * Usage:
 *   bun run scripts/dehotlink-article-links.ts            # dry run
 *   bun run scripts/dehotlink-article-links.ts --execute
 */

const SERVED_ROOT = "D:\\Luka\\JKNM\\served";

async function find_by_legacy_id(legacy_id: number) {
	return db.query.Article.findFirst({
		where: eq(Article.legacy_id, legacy_id),
		columns: {},
		with: { article_slugs: { columns: { slug: true, is_primary: true } } },
	});
}

async function main() {
	const { values } = parseArgs({ options: { execute: { type: "boolean" } } });
	const execute = values.execute ?? false;

	const articles = await db.query.Article.findMany({
		columns: { id: true, legacy_id: true, title: true, content_json: true },
	});

	const b2 = execute
		? await B2.authorize({
				applicationKeyId: env.AWS_ACCESS_KEY_ID,
				applicationKey: env.AWS_SECRET_ACCESS_KEY,
			})
		: null;

	let touched = 0;
	for (const article of articles) {
		if (!article.content_json) continue;
		const original = JSON.stringify(article.content_json);

		const pdf_refs = find_pdf_refs(original);
		const id_refs = find_legacy_id_refs(original);
		if (pdf_refs.length === 0 && id_refs.length === 0) continue;

		console.log(`\n[${article.legacy_id}] ${article.title}`);
		const replacements = new Map<string, string>();

		for (const url of pdf_refs) {
			const key = static_asset_key(url);
			const { bytes, source } = await resolve_pdf_bytes(url, key, SERVED_ROOT);
			console.log(
				`  [pdf] ${url} -> ${key} (from ${source}, ${bytes.byteLength}B)`,
			);

			if (execute) {
				if (!b2) throw new Error("b2 client not initialized");
				const bucket_obj = await b2.bucket(
					env.NEXT_PUBLIC_AWS_STATIC_BUCKET_NAME,
				);
				await bucket_obj.upload(key, bytes, {
					contentType: mime.getType(key) ?? "application/octet-stream",
					contentLength: bytes.byteLength,
				});
			}
			replacements.set(url, static_content_url(key));
		}

		for (const ref of id_refs) {
			const new_url = await resolve_legacy_article_link(
				ref.legacy_id,
				find_by_legacy_id,
			);
			console.log(`  [id]  ${ref.raw} -> ${new_url}`);
			replacements.set(ref.raw, new_url);
		}

		if (!execute || replacements.size === 0) continue;

		let rewritten = original;
		for (const [old_url, new_url] of replacements) {
			rewritten = rewritten.split(old_url).join(new_url);
		}
		if (rewritten === original) continue;

		const content = JSON.parse(rewritten) as ArticleContentType;
		await db
			.update(Article)
			.set({ content_json: content })
			.where(eq(Article.id, article.id));
		touched += 1;
	}

	console.log(`\n${touched} article(s) rewritten.`);
	if (!execute) {
		console.log("Dry run only — re-run with --execute to upload + rewrite.");
	}
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
