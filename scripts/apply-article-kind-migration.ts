/**
 * One-off DDL for #35: adds the `article_kind` enum + column that
 * `src/server/db/schema.ts` now declares. Plain SQL via the `postgres`
 * client rather than `drizzle-kit push`, because `push`'s interactive
 * confirmation prompt can't run in a non-TTY session — this project has no
 * migration-file history (schema changes are normally applied with `push`
 * directly against a terminal), so this script is the one-time substitute.
 * Idempotent: safe to re-run against a DB that already has the column.
 *
 * Usage:
 *   dotenv -e .env.local -e .env.staging --override -- bun run scripts/apply-article-kind-migration.ts
 *   dotenv -e .env.local -- bun run scripts/apply-article-kind-migration.ts   # prod
 */

import { sql } from "drizzle-orm";
import { db } from "~/server/db";

async function main() {
	await db.execute(sql`
		DO $$ BEGIN
			CREATE TYPE "public"."article_kind" AS ENUM ('article', 'content');
		EXCEPTION
			WHEN duplicate_object THEN NULL;
		END $$;
	`);

	await db.execute(sql`
		ALTER TABLE "articles"
		ADD COLUMN IF NOT EXISTS "article_kind" "public"."article_kind" NOT NULL DEFAULT 'article';
	`);

	const [row] = await db.execute<{ count: number }>(sql`
		SELECT count(*)::int FROM "articles" WHERE "article_kind" = 'content';
	`);
	if (!row) throw new Error("Count query returned no rows");
	console.log(`Done. ${row.count} content-kind row(s) currently exist.`);
}

main()
	.catch((error: unknown) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
