import { PGlite } from "@electric-sql/pglite";
import { pushSchema } from "drizzle-kit/api";
import { drizzle } from "drizzle-orm/pglite";
import type { db as real_db } from "./index";
import * as schema from "./schema";

/**
 * An in-memory Postgres-compatible database (PGlite) with the Drizzle schema
 * pushed, for data-access seam tests that need real query behavior (joins,
 * filters, ordering) without a live Postgres instance. Cast to the app's `db`
 * type: the query-builder surface used by data-access functions is identical
 * across the postgres-js and PGlite drivers, only the underlying client differs.
 */
export async function create_test_db(): Promise<typeof real_db> {
	const client = new PGlite();
	const db = drizzle(client, { schema });

	const { apply } = await pushSchema(
		schema,
		db as unknown as Parameters<typeof pushSchema>[1],
	);
	await apply();

	return db as unknown as typeof real_db;
}
