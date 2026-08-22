import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "~/env";
import { DOMAIN_EVENTS } from "~/lib/cache-policy";
import { apply_route_invalidations } from "~/server/cache-invalidation";

const body_validator = z.object({
	event: z.enum(DOMAIN_EVENTS),
});

/**
 * Bridges the route-handler invalidation adapter to callers outside a live Server
 * Action. Migration/admin scripts (`scripts/migrate/publish-content-page.ts`)
 * mutate the DB directly via `publish_article` et al. rather than going
 * through the oRPC layer, but `updateTag` only works inside a Server Action;
 * this route therefore uses `revalidateTag` instead
 * — the script's own standalone process can never be one, so calling
 * `publish_article` from a script always throws right after its DB write and
 * Algolia sync have already succeeded (see that script's error handling).
 * Hitting this route from the script instead runs the invalidation inside
 * the actual live server process, which is the one that needs its cache
 * busted. Authed by a shared secret rather than a session, since scripts
 * have no browser to hold one — same shape as Next's own on-demand-
 * revalidation recipe.
 */
export async function POST(request: Request) {
	if (request.headers.get("x-revalidate-secret") !== env.REVALIDATE_SECRET) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const parsed = body_validator.safeParse(await request.json());
	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.message }, { status: 400 });
	}

	apply_route_invalidations(parsed.data.event);
	return NextResponse.json({ revalidated: true });
}
