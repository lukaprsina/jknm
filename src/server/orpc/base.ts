import { ORPCError, os } from "@orpc/server";
import type { ORPCContext } from "./context";

/**
 * The root builder every procedure is derived from. `.$context<ORPCContext>()`
 * makes `session` a required initial-context field — callers (the RSC direct
 * client, the HTTP route mount, tests) must supply it explicitly, per
 * vendor/orpc/apps/content/docs/context.md's initial-context contract.
 */
export const base = os.$context<ORPCContext>();

/**
 * Only gates on `context.session` — never reads `next/headers` itself, so it
 * composes and tests without a request scope. Input validation is a separate,
 * composable concern: attach `.input(validator)` per procedure instead of
 * bundling it into this guard.
 */
export const requireAuth = base.middleware(async ({ context, next }) => {
	if (!context.session) {
		throw new ORPCError("UNAUTHORIZED");
	}

	return next({
		context: { session: context.session },
	});
});

/** Base for every authenticated procedure: session guaranteed non-null. */
export const authed = base.use(requireAuth);
