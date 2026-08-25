/**
 * Backfill Better Auth 1.7 account identities.
 *
 * Run after the nullable `account.issuer` column has been pushed and before
 * making it NOT NULL / adding the compound unique index:
 *
 *   dotenv -e .env.local -- bun run scripts/migrate/backfill-account-issuer.ts
 *
 * The script refuses unknown provider IDs and duplicate identities. It is
 * transactional and safe to re-run after a successful or rolled-back attempt.
 */

import { sql } from "drizzle-orm";
import { db } from "~/server/db";

const GOOGLE_ISSUER = "https://accounts.google.com";

async function main() {
	await db.transaction(async (tx) => {
		const columnRows = await tx.execute<{ columnExists: boolean }>(sql`
			SELECT EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_schema = current_schema()
				  AND table_name = 'account'
				  AND column_name = 'issuer'
			) AS "columnExists"
		`);
		const columnRow = columnRows[0];
		if (!columnRow) throw new Error("Could not inspect account.issuer.");
		const { columnExists } = columnRow;
		if (!columnExists) {
			throw new Error(
				"account.issuer does not exist. Push the nullable Drizzle schema before running this script.",
			);
		}

		const providerRows = await tx.execute<{ providerId: string; count: number }>(sql`
			SELECT provider_id AS "providerId", count(*)::int AS count
			FROM account
			GROUP BY provider_id
			ORDER BY provider_id
		`);
		const unsupported = providerRows.filter(
			({ providerId }) => providerId !== "google" && providerId !== "credential",
		);
		if (unsupported.length > 0) {
			throw new Error(
				`Unknown account provider(s): ${unsupported.map(({ providerId }) => providerId).join(", ")}. Add an explicit issuer mapping before continuing.`,
			);
		}

		const googleUpdated = await tx.execute(sql`
			UPDATE account
			SET issuer = ${GOOGLE_ISSUER}
			WHERE provider_id = 'google' AND issuer IS NULL
			RETURNING 1
		`);

		const credentialUpdated = await tx.execute(sql`
			UPDATE account AS a
			SET issuer = 'local:credential',
				account_id = u.id
			FROM "user" AS u
			WHERE a.user_id = u.id
			  AND a.provider_id = 'credential'
			  AND a.issuer IS NULL
			RETURNING 1
		`);

		const missingRows = await tx.execute<{ missing: number }>(sql`
			SELECT count(*)::int AS missing
			FROM account
			WHERE issuer IS NULL
		`);
		const missingRow = missingRows[0];
		if (!missingRow) throw new Error("Could not verify the issuer backfill.");
		const { missing } = missingRow;
		if (missing !== 0) {
			throw new Error(`${missing} account row(s) still have no issuer.`);
		}

		const collisions = await tx.execute<{
			issuer: string;
			accountId: string;
			accountCount: number;
			userCount: number;
		}>(sql`
			SELECT issuer,
				account_id AS "accountId",
				count(*)::int AS "accountCount",
				count(DISTINCT user_id)::int AS "userCount"
			FROM account
			GROUP BY issuer, account_id
			HAVING count(*) > 1
		`);
		if (collisions.length > 0) {
			throw new Error(
				`Identity collisions found: ${JSON.stringify(collisions)}. Resolve them before adding the unique index.`,
			);
		}

		console.log(
			`Backfill complete: ${googleUpdated.length} Google row(s), ${credentialUpdated.length} credential row(s) updated; no collisions found.`,
		);
	});
}

main()
	.catch((error: unknown) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
