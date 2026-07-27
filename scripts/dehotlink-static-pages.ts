import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import B2 from "b2-js";
import { eq } from "drizzle-orm";
import { glob } from "glob";
import mime from "mime/lite";
import { env } from "~/env";
import {
	find_legacy_id_refs,
	find_pdf_refs,
	static_asset_key,
} from "~/lib/dehotlink-static-refs";
import { resolve_legacy_article_link } from "~/lib/resolve-legacy-article-link";
import { static_content_url } from "~/lib/static-content-upload";
import { db } from "~/server/db";
import { Article } from "~/server/db/schema";

/**
 * One-off: rewrites the still-hotlinked www.jknm.si links in the static MDX
 * pages (src/app/(static)) — see docs/research/static-pages-jknm-si-dehotlinking.md
 * and ADR-0008. Two independent link shapes, each resolved differently:
 *   - /media/... file links (PDFs): self-hosted by copying from the local
 *     `served` mirror of the old site (fallback: live fetch) into the
 *     `jknm-vsebina` B2 bucket, then rewritten to vsebina.jknm.org.
 *   - /si/?id=<legacy_id> article links: rewritten to the migrated article's
 *     current /novica/<slug>, via Article.legacy_id. Throws on a miss —
 *     every 2008-site article has a migrated counterpart, manually verified,
 *     so a miss here means the extraction or the data is wrong, not that
 *     it's safe to skip.
 *
 * Usage:
 *   bun run scripts/dehotlink-static-pages.ts            # dry run
 *   bun run scripts/dehotlink-static-pages.ts --execute   # upload + rewrite
 */

// Local mirror of the old ASP-era site, path-for-path from site root (its
// `media/pdf/...` matches `https://www.jknm.si/media/pdf/...`) — see the
// research doc's §5.
const SERVED_ROOT = "D:\\Luka\\JKNM\\served";

const PDF_MAGIC = Buffer.from("%PDF-");

function is_pdf(bytes: Buffer) {
	return bytes.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC);
}

async function read_served_pdf(served_path: string) {
	let bytes: Buffer;
	try {
		bytes = await fs.readFile(served_path);
	} catch {
		return null;
	}
	if (!is_pdf(bytes)) {
		throw new Error(`${served_path} exists but isn't a PDF`);
	}
	return bytes;
}

async function fetch_live_pdf(url: string) {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.status}`);
	}
	const bytes = Buffer.from(await response.arrayBuffer());
	// The old ASP server returns HTTP 200 with a generic HTML error page for
	// some urls containing diacritics/spaces/commas, instead of a real 404 —
	// a 200 status alone can't be trusted, so require real PDF bytes.
	if (!is_pdf(bytes)) {
		throw new Error(
			`Fetched ${url} but response isn't a PDF (likely a disguised error page)`,
		);
	}
	return bytes;
}

async function resolve_pdf_bytes(url: string, key: string) {
	const served_path = path.join(SERVED_ROOT, key);
	const served_bytes = await read_served_pdf(served_path);
	if (served_bytes) return { bytes: served_bytes, source: "served" as const };

	const bytes = await fetch_live_pdf(url);
	return { bytes, source: "live" as const };
}

async function find_by_legacy_id(legacy_id: number) {
	return db.query.Article.findFirst({
		where: eq(Article.legacy_id, legacy_id),
		columns: {},
		with: { article_slugs: { columns: { slug: true, is_primary: true } } },
	});
}

async function process_file(
	file: string,
	execute: boolean,
	b2: Awaited<ReturnType<typeof B2.authorize>> | null,
) {
	const original = await fs.readFile(file, "utf8");
	const replacements = new Map<string, string>();

	for (const url of find_pdf_refs(original)) {
		const key = static_asset_key(url);
		const { bytes, source } = await resolve_pdf_bytes(url, key);
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

	for (const ref of find_legacy_id_refs(original)) {
		const new_url = await resolve_legacy_article_link(
			ref.legacy_id,
			find_by_legacy_id,
		);
		console.log(`  [id]  ${ref.raw} -> ${new_url}`);
		replacements.set(ref.raw, new_url);
	}

	if (replacements.size === 0) return;

	let rewritten = original;
	for (const [old_url, new_url] of replacements) {
		rewritten = rewritten.replaceAll(old_url, new_url);
	}

	if (execute) {
		await fs.writeFile(file, rewritten, "utf8");
	}
}

async function main() {
	const { values } = parseArgs({ options: { execute: { type: "boolean" } } });
	const execute = values.execute ?? false;

	const files = await glob("src/app/(static)/**/content.mdx", {
		absolute: true,
	});
	console.log(`${files.length} static content file(s) found.`);

	const b2 = execute
		? await B2.authorize({
				applicationKeyId: env.AWS_ACCESS_KEY_ID,
				applicationKey: env.AWS_SECRET_ACCESS_KEY,
			})
		: null;

	for (const file of files) {
		console.log(file);
		await process_file(file, execute, b2);
	}

	if (!execute) {
		console.log(
			"Dry run only — re-run with --execute to upload assets and rewrite files.",
		);
	}
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
