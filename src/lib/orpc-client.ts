"use client";

import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { router } from "~/server/orpc/router";

/**
 * Browser client: talks to the HTTP mount at `src/app/api/orpc/[[...rest]]`.
 * Not used from Server Components — those go through
 * `~/lib/orpc-client.server`'s in-process client instead.
 */
const link = new RPCLink({
	url: "/api/orpc",
});

const client: RouterClient<typeof router> = createORPCClient(link);

/**
 * `.queryOptions()`/`.mutationOptions()`/`.key()` helpers for TanStack Query.
 * Deliberately not wired to drive cache invalidation itself — invalidation
 * stays exclusively on `apply_client_invalidations`/`invalidations_for()` (see
 * `~/lib/cache-invalidation-client.ts`), so there is exactly one place that
 * decides what a domain event invalidates. Populate a mutation's `onSuccess`
 * with `apply_client_invalidations(queryClient, event)` yourself; do not call
 * `queryClient.invalidateQueries(orpc.<x>.key())` next to it.
 */
export const orpc = createTanstackQueryUtils(client);
