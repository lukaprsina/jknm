import type { QueryClient } from "@tanstack/react-query";
import { type DomainEvent, invalidations_for } from "./cache-policy";

/**
 * Client-side adapter over the cache policy: translates a domain event into
 * TanStack Query invalidations. The counterpart to
 * `apply_server_invalidations`, reading the same descriptor so the two caches
 * cannot disagree about what an event affects.
 *
 * A dumb translator — the rules live in `~/lib/cache-policy`.
 */
export async function apply_client_invalidations(
	query_client: QueryClient,
	event: DomainEvent,
) {
	const { query_keys } = invalidations_for(event);

	await Promise.all(
		query_keys.map((query_key) =>
			query_client.invalidateQueries({ queryKey: [...query_key] }),
		),
	);
}
