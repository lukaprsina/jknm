import "server-only";

import { createRouterClient } from "@orpc/server";
import { getServerAuthSession } from "~/server/auth";
import { router } from "~/server/orpc/router";

/**
 * The in-process client for Server Components / Server Actions: calls
 * procedures directly, no HTTP round-trip, no serialization — the lower-
 * overhead of oRPC's two documented SSR options (see
 * vendor/orpc/apps/content/docs/best-practices/optimizing-ssr.md, "Using
 * Server-Side Client Directly").
 *
 * This instance is created once and shared across requests, so `context`
 * is supplied as the async-function form: it re-resolves the session on
 * every call rather than baking one request's session into the client.
 */
export const serverClient = createRouterClient(router, {
	context: async () => ({ session: await getServerAuthSession() }),
});
