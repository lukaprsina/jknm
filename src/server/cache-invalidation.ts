import { revalidatePath, updateTag } from "next/cache";
import { type DomainEvent, invalidations_for } from "~/lib/cache-policy";

/**
 * Server-side adapter over the cache policy: translates a domain event into
 * Next data-cache and route-cache invalidations. A dumb translator — the rules
 * live in `~/lib/cache-policy`, and nothing here decides anything.
 *
 * `revalidatePath("/")` alone is not enough and never was: it clears the route
 * cache, while `unstable_cache` entries are keyed by function identity rather
 * than by path. Both halves are needed, which is exactly the sort of thing a
 * caller should not have to remember at 22 separate call sites.
 *
 * `updateTag`, not `revalidateTag(tag, "max")`: every call site here is a
 * Server Action (`updateTag`'s one restriction), and "max" is stale-while-
 * revalidate by design — the request right after a mutation can still get
 * the pre-mutation value. That's exactly what let an admin who republished
 * an article under a new slug still see the stale page for the old one and
 * crash clicking the pencil on it (its source had since gone `deleted`).
 * `updateTag` blocks the next reader on fresh data instead, which costs a
 * beat of latency but this site's traffic is small enough that it's a clear
 * trade for not shipping read-your-own-writes bugs.
 */
export function apply_server_invalidations(event: DomainEvent) {
	const { tags, paths } = invalidations_for(event);

	for (const tag of tags) {
		updateTag(tag);
	}

	for (const path of paths) {
		revalidatePath(path);
	}
}
