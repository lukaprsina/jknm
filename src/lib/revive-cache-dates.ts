/**
 * `unstable_cache` persists results via `JSON.stringify`/`JSON.parse`, which
 * silently turns `Date` columns into ISO strings on a cache hit (a real
 * `Date` survives only on a cache miss, since it's returned pre-serialization).
 * Apply this to every value coming out of an `unstable_cache`-wrapped call
 * that can contain a Drizzle timestamp column, keyed by our `*_at` column
 * naming convention (created_at, updated_at, archived_at, deleted_at, ...).
 */
export function revive_cache_dates<T>(value: T): T {
	if (Array.isArray(value)) {
		return value.map(revive_cache_dates) as T;
	}
	if (value === null || typeof value !== "object" || value instanceof Date) {
		return value;
	}
	const result: Record<string, unknown> = {};
	for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
		result[key] =
			key.endsWith("_at") && typeof entry === "string"
				? new Date(entry)
				: revive_cache_dates(entry);
	}
	return result as T;
}
