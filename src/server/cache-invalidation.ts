import { revalidatePath, revalidateTag } from "next/cache";
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
 */
export function apply_server_invalidations(event: DomainEvent) {
	const { tags, paths } = invalidations_for(event);

	for (const tag of tags) {
		revalidateTag(tag, "max");
	}

	for (const path of paths) {
		revalidatePath(path);
	}
}
