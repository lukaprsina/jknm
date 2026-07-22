import "@orpc/next/extensions/actionable";

import { ORPCError, os } from "@orpc/server";
import { getServerAuthSession } from "~/server/auth";
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

/**
 * Shared `.actionable()` options: mutations need to run as real Next.js
 * Server Actions, not calls through the `/api/orpc` Route Handler — Next 16's
 * `updateTag` (what `apply_server_invalidations` uses) throws when called
 * from anywhere else. `.actionable()` (`@orpc/next`) turns a procedure into a
 * server function callable directly from a client component, resolving
 * `context.session` itself the same way the HTTP route does.
 */
export const actionableOptions = {
	context: async () => ({ session: await getServerAuthSession() }),
};
