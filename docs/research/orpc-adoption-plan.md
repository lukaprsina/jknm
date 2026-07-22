# oRPC adoption plan for issue #31 step 4

Companion to `docs/adr/0002-orpc-not-server-actions.md` (the "why", already decided)
and steps 1-3 of issue #31 (already shipped: `src/lib/cache-policy.ts`,
`src/server/cache-invalidation.ts`, `src/lib/cache-invalidation-client.ts`, the
Shell session-read Suspense split). This document answers the "how" for step 4:
"oRPC procedures wrapping the existing actions."

Sources: the real oRPC docs, vendored at `vendor/orpc/apps/content/docs` (cited as
`vendor/orpc/apps/content/docs/<path>` throughout — every API claim below is
traceable to one of these files, no training-data recall), and this repo's own
source (cited by path). The submodule is pinned at **`v2.0.0-beta.18-21-g428ad93e`**
(`git submodule status`, checked 2026-07-22) — `vendor/orpc/apps/content/docs/*`
therefore documents oRPC **2.0**, currently shipped to npm under the **`@beta`**
dist-tag (every install snippet in the docs reads `npm install @orpc/server@beta`
etc. — see e.g. `vendor/orpc/apps/content/docs/client/client-side.md:11` and
`vendor/orpc/apps/content/docs/integrations/tanstack-query.md:14`). §7 expands on
what that means for this migration. Nothing from oRPC is in `package.json` yet
(`grep orpc package.json` — no match); zod is already at `^4.4.3`, and
`vendor/orpc/apps/content/docs/integrations/zod.md:6` requires "Zod v4 or later"
for `@orpc/zod`, so the existing zod major is already compatible.

---

## 1. Router/procedure file layout

**Constraint restated:** existing files must not move. `lifecycle.ts`,
`new-article.ts`, `lifecycle-rules.ts`, `reconcile-media.ts`, `article-queries.ts`,
`author/rename.ts`, etc. keep their current paths and signatures — they are the
"framework-agnostic modules" ADR-0002's Consequences section names as the reason
the future TanStack Start rewrite stays cheap. oRPC's own architecture makes this
easy to satisfy, not fought against: `vendor/orpc/apps/content/docs/router.md:9-24`
defines a router as "a plain JavaScript object where each key maps to a
procedure" — routers are just objects assembled *around* existing functions, they
don't require the functions themselves to move anywhere.

Recommended new files (all additions, nothing existing touched):

```
src/server/
  orpc/
    base.ts              # os builder + shared middleware (auth, logging)
    context.ts            # initial-context shape: { headers: Headers }
    router.ts             # assembles the full router from procedure modules below
    article/
      procedures.ts        # thin procedures wrapping lifecycle.ts / new-article.ts
    author/
      procedures.ts        # thin procedures wrapping author/*.ts
  article/                 # UNCHANGED: lifecycle.ts, new-article.ts, validators.ts, ...
  author/                  # UNCHANGED: rename.ts, insert.ts, delete.ts, validator.ts, ...
  auth/                    # UNCHANGED: index.ts, session-shape.ts, sign-in-gate.ts
src/app/api/orpc/[[...rest]]/route.ts   # RPCHandler mount, alongside the existing
                                          # src/app/api/{auth,media,send,wake_supabase}/
                                          # route.ts siblings
src/lib/
  orpc-client.ts            # browser RPCLink client + createTanstackQueryUtils(...)
  orpc-client.server.ts     # server-side client for RSC (see §4)
```

Rationale for `src/server/orpc/<domain>/procedures.ts` rather than one flat
`src/server/orpc/router.ts` with inline handlers: `vendor/orpc/apps/content/docs/router.md:47-59`
documents lazy routers (`os.lazy(() => import('./planet'))`) specifically for
splitting a router across files as it grows — the doc's own example puts each
domain's procedures in a sibling file (`planet.ts`) and imports it lazily into
the root router. Mirroring that shape (`article/procedures.ts`,
`author/procedures.ts`) keeps `router.ts` a pure assembly file and gives an easy
lazy-loading upgrade later without restructuring again.

`src/server/orpc/` is new — it does not collide with the "no moving existing
files" constraint because nothing currently lives at that path. It sits next to
(not inside) `src/server/article/` and `src/server/author/`, which is the layout
`docs/adr/0002-orpc-not-server-actions.md:76-78` already commits to keeping
untouched.

---

## 2. Auth middleware (replacing `run_authorized_mutation`)

### What it replaces, exactly

`src/server/article/authorized-mutation.ts` today:

```ts
export async function run_authorized_mutation<Schema extends z.ZodTypeAny>(
	validator: Schema,
	input: z.input<Schema>,
): Promise<{ session: Session; input: z.output<Schema> }> {
	const session = await getServerAuthSession();
	if (!session) throw new Error("Unauthorized");

	const validated = validator.safeParse(input);
	if (!validated.success) throw new Error(validated.error.message);

	return { session, input: validated.data };
}
```

It does two unrelated things in one call: (1) session guard, (2) zod validation
— which is exactly the composability problem ADR-0002 names ("one fixed guard
that can't compose", `docs/adr/0002-orpc-not-server-actions.md:38-39`). Note also
that `src/server/author/rename.ts`, `insert.ts`, `delete.ts`, and
`sync_members.ts` **don't even use this guard** — each hand-rolls the identical
`if (!session) throw new Error("Unauthorized")` + `validator.safeParse` pair
inline. oRPC middleware collapses both call patterns into one composable piece.

### The actual better-auth setup this must be grounded in

`src/server/auth/index.ts` exports `getServerAuthSession` — a React-`cache`-memoized
async function that calls `auth.api.getSession({ headers: await headers() })` and
adapts the result via `to_app_session` (`src/server/auth/session-shape.ts`) into:

```ts
export interface Session {
	user: { id: string; name: string | null; email: string | null; image: string | null };
	expires: string; // ISO-8601
}
```

### The middleware, grounded in the vendor docs' own auth-shaped example

`vendor/orpc/apps/content/docs/context.md:92-122` ("Combining Initial and Injected
Context") is the doc's own worked example of exactly this pattern — declare
`headers` as initial context, write a `requireAuth` middleware that parses it into
a user and throws `ORPCError('UNAUTHORIZED')` on failure, and note in
`vendor/orpc/apps/content/docs/middleware.md:50-81` ("Middleware Context") that
context passed to `next()` can *narrow* a previously-optional field to
non-nullable for everything downstream. Adapted to this repo's real
`getServerAuthSession` (not a hypothetical `parseJWT`):

```ts
// src/server/orpc/context.ts
export interface ORPCContext {
	headers: Headers;
}

// src/server/orpc/base.ts
import { ORPCError, os } from "@orpc/server";
import { getServerAuthSession, type Session } from "~/server/auth";
import type { ORPCContext } from "./context";

export const base = os.$context<ORPCContext>();

export const requireAuth = base.middleware(async ({ context, next }) => {
	// getServerAuthSession() reads `headers()` itself (Next's request-scoped
	// helper), not `context.headers` — see src/server/auth/index.ts. It stays
	// as the one call site that names better-auth, per ADR-0002's framework-
	// agnostic-module boundary; the middleware just gates on its result.
	const session = await getServerAuthSession();

	if (!session) {
		throw new ORPCError("UNAUTHORIZED");
	}

	return next({
		context: { session } satisfies { session: Session },
	});
});

export const authed = base.use(requireAuth);
```

Then a procedure built from `authed` has `context.session: Session` guaranteed
non-null in its handler, exactly as `vendor/orpc/apps/content/docs/middleware.md:59-80`
shows for the `context.auth` narrowing pattern ("now guaranteed to be non-null
here").

Two things to flag against the vendor docs, both real:

- **Dedupe.** `vendor/orpc/apps/content/docs/best-practices/dedupe-middleware.md:1-37`
  warns that the same middleware "can run more than once during a single call"
  when one procedure calls another that also uses it, and recommends caching the
  loaded value in context and checking a `*Loaded` boolean flag before reloading.
  This repo's `requireAuth` is cheap to re-run as written (it delegates to
  `getServerAuthSession`, which is already `cache()`-memoized per request in
  `src/server/auth/index.ts` — so a second middleware pass just hits the React
  cache, not the session table again). No extra dedupe flag is needed *because*
  the memoization already lives in the wrapped function, not because the
  middleware pattern is exempt from the doc's warning.
- **`.errors` vs. bare `ORPCError`.** `vendor/orpc/apps/content/docs/error-handling.md:81-83`
  recommends reserving `.errors`-typed errors for app-specific cases and using
  the untyped `ORPCError('UNAUTHORIZED')` for common ones like this, "since the
  client usually already understands the meaning" — which is what the sketch
  above does; no `.errors({ UNAUTHORIZED: {...} })` boilerplate needed on every
  procedure.

---

## 3. Wiring the existing Zod validators as oRPC input schemas

`src/server/article/validators.ts` exports plain zod objects
(`save_article_validator`, `publish_article_validator`, `archive_article_validator`,
etc.) — no oRPC-specific wrapping exists today, and none is required. Zod
implements Standard Schema, so `vendor/orpc/apps/content/docs/integrations/zod.md:1-7`
states procedures can use it "directly... without any extra setup" (the only
requirement flagged is Zod v4, already satisfied — see the intro above).
`vendor/orpc/apps/content/docs/procedure.md:60-66` documents `.input(schema)` as
accepting any Standard Schema library. Concretely, for `archive_article`:

```ts
// src/server/orpc/article/procedures.ts
import { authed } from "../base";
import { archive_article_validator } from "~/server/article/validators";
import { archive_article } from "~/server/article/lifecycle";

export const archiveArticle = authed
	.input(archive_article_validator)
	.handler(async ({ input }) => {
		// lifecycle.ts's run_authorized_mutation still re-checks the session and
		// re-parses input today — see the migration note below.
		return archive_article(input);
	});
```

**Migration note, not a design flaw to solve now:** `archive_article` (and every
other function in `lifecycle.ts` / `new-article.ts` / `author/*.ts`) still calls
`run_authorized_mutation` (or its inlined duplicate) internally. Step 4 wrapping
these in oRPC procedures makes the auth+validation happen *twice* per call
(once in the oRPC middleware/`.input()`, once inside the wrapped function)
until those internal calls are deleted. Two sequencing options, stated plainly
so the plan doesn't quietly assume one:

1. Land the procedures first with double-checking (safe, redundant, no behavior
   change since both checks agree), then a follow-up strips
   `run_authorized_mutation` calls out of `lifecycle.ts`/`new-article.ts`/
   `author/*.ts` once every caller goes through a procedure.
2. Do both in one step 4 PR.

Given the "procedures stay THIN... delegate to existing business logic" framing
of the issue and the "already true today" note in
`docs/adr/0002-orpc-not-server-actions.md:78`, (1) is the lower-risk order: it
decouples "add the oRPC seam" from "delete the old guard", so a bug in one is
independently bisectable from a bug in the other. This document does not decide
which sub-PR strips the old guard — flagging it here so it isn't lost.

For validators whose zod schema differs from what the oRPC input needs
(none currently do — every `*_validator` in `validators.ts` and `author/validator.ts`
is already the exact procedure input shape), `vendor/orpc/apps/content/docs/procedure.md:68-85`
documents stacking multiple `.input()` calls if a shape ever needs augmenting
without touching the original schema, though nothing in this repo currently
needs it.

---

## 4. Server Components calling procedures directly (no HTTP round-trip)

This is documented in two places that agree with each other:

- `vendor/orpc/apps/content/docs/client/server-side.md:1-21` ("Server-Side
  Clients... call procedures locally, within the same process") documents
  `call(procedure, input, { context })` for one-off calls, and
  `createRouterClient(router, { context })` (lines 23-59) for a client covering
  the whole router.
- `vendor/orpc/apps/content/docs/best-practices/optimizing-ssr.md` is the
  dedicated guide for exactly this Next.js scenario. Its "Using Server-Side
  Client Directly" section (lines 118-144) is explicit that this is the
  *lower-overhead* of its two documented options ("eliminates serialization and
  deserialization overhead entirely", vs. the fetch-based internal-link
  alternative in the same doc which still round-trips through
  request/response serialization in-process). It gives the concrete Next.js
  recipe:

```ts
// src/lib/orpc-client.server.ts — mirrors optimizing-ssr.md's own snippet,
// adapted to this repo's context shape (§2) and session helper
import "server-only";
import { createRouterClient } from "@orpc/server";
import { headers } from "next/headers";
import { router } from "~/server/orpc/router";

export const serverClient = createRouterClient(router, {
	// optimizing-ssr.md:132-142 warns this instance is shared across all
	// requests, so only per-process-safe values belong in `context` here —
	// per-request values (headers) are supplied via the async function form,
	// matching the doc's own recipe.
	context: async () => ({ headers: await headers() }),
});
```

Server Components then call `serverClient.article.archive({ article_id })`
exactly like a local async function
(`vendor/orpc/apps/content/docs/best-practices/optimizing-ssr.md:150-161`'s
`PlanetListPage` example), no fetch, no HTTP handler involved for this path.

`vendor/orpc/apps/content/docs/best-practices/optimizing-ssr.md:95-114` also
documents registering the client early via `instrumentation.ts` and importing
it at the top of `app/layout.tsx` so it's available before any render — worth
following exactly as written since it's Next-App-Router-specific plumbing this
repo will need regardless of which of the two SSR strategies it picks.

Recommendation: use the server-side-client-direct approach (not the fetch-based
internal-link alternative also in that same doc) — it's what the doc itself
calls the more efficient, simpler-to-set-up option for a repo with no second
consumer of the internal link's serialization behavior, and it avoids adding a
`globalThis.$client` fetch-interception hack (`optimizing-ssr.md:33-91`) that
buys plugin/link compatibility this repo has no current use for.

---

## 5. `@orpc/tanstack-query` vs. the existing `cache-invalidation-client.ts` — pick one

**Recommendation: keep `@orpc/tanstack-query` for query/mutation *options and
keys* only; do not let its mutation lifecycle hooks drive invalidation. All
invalidation continues to flow exclusively through `apply_client_invalidations`
/ `invalidations_for()`.** Concretely: use `orpc.article.archive.mutationOptions()`
for `useMutation`, but never populate its `onSuccess` with
`queryClient.invalidateQueries({ queryKey: orpc.article.key() })`. Instead, the
mutation's own `onSuccess` (or a shared wrapper) calls
`apply_client_invalidations(queryClient, "article.archived")` exactly as today.

Why, concretely, against this repo's own architecture:

- `src/lib/cache-policy.ts`'s entire design point, stated in its own header
  comment, is that "Neither adapter holds rules, so the two caches cannot drift
  apart" — `apply_server_invalidations` (Next tags/paths) and
  `apply_client_invalidations` (TanStack Query keys) both read the *same*
  `InvalidationDescriptor` from `invalidations_for(event)`. The whole reason
  `cache-policy.test.ts` exists (referenced in `cache-policy.ts`'s own comments,
  "reachability test") is to catch exactly the failure mode of a tag or key
  becoming unreachable from any event. If `@orpc/tanstack-query`'s
  `mutationOptions().onSuccess` is used to invalidate `orpc.article.key()`
  independently, that invalidation now lives in a *third* place outside
  `cache-policy.ts`, and the reachability guarantee stops covering it —
  reintroducing precisely the "ad-hoc, hand-written at each of ~12 call sites"
  problem ADR-0002 names as the reason to adopt oRPC in the first place
  (`docs/adr/0002-orpc-not-server-actions.md:19-22`).
- oRPC's own query-key generation and the cache-policy's `query_keys` are
  *structurally different vocabularies* that would need reconciling if merged:
  `vendor/orpc/apps/content/docs/integrations/tanstack-query.md:164-202` documents
  `orpc.<router>.<procedure>.key()` / `.queryKey({ input })` as generated from
  the router's *shape*, whereas `cache-policy.ts`'s `HOMEPAGE_FEED_KEYS =
  [["infinite_published"]]` is a hand-named key for `app/infinite-no-trpc.tsx`'s
  query that has no corresponding oRPC *query* procedure at all today (the
  homepage feed is read via a separate mechanism, not one of the mutation
  procedures being wrapped in step 4). Adopting oRPC-generated keys for the
  mutation side while `cache-policy.ts` still names the homepage-feed key by
  hand would require either (a) migrating the homepage feed to an oRPC query
  procedure too — out of scope for step 4, which is about wrapping existing
  *actions* (mutations) — or (b) running two key-naming schemes side by side
  indefinitely, which is the drift `cache-policy.ts` was built to prevent.
- This is not a rejection of the plugin's value: `.mutationOptions()` and
  `.queryOptions()` still standardize the boilerplate ADR-0002 calls out
  directly — "Query-key and options conventions — currently 12 bespoke,
  hand-maintained call sites. This is what `@orpc/tanstack-query` exists to
  standardize" (`docs/adr/0002-orpc-not-server-actions.md:39-40`). Using it for
  options/keys *generation* while keeping `cache-policy.ts` as the sole
  invalidation authority captures that value without duplicating the
  invalidation decision.
- Practically, the split is two lines per call site:

```ts
const mutation = useMutation({
	...orpc.article.archive.mutationOptions(),
	onSuccess: () => apply_client_invalidations(queryClient, "article.archived"),
});
```

This mirrors `vendor/orpc/apps/content/docs/integrations/tanstack-query.md:260-267`'s
own documented `onSuccess` hook shape for mutations (its example calls
`ctx.client.invalidateQueries(...)` inline; this repo's version calls
`apply_client_invalidations(...)` instead, which internally does the same
`invalidateQueries` calls per `src/lib/cache-invalidation-client.ts`) — so no
new integration surface is being invented, just redirecting *what* populates
`onSuccess`, not introducing a new hook shape oRPC doesn't already support.

One consequence worth stating: `@orpc/tanstack-query`'s auto-generated query
keys (used for `queryOptions`, if/when article *reads* are ever wrapped in
step-4-adjacent work) and `cache-policy.ts`'s hand-named `query_keys` will be
two different key vocabularies for anything that becomes both an oRPC query
procedure and a cache-policy target. That is out of scope today (step 4 wraps
existing mutations/actions only), but should be flagged for whoever eventually
wraps a *read* path: at that point `cache-policy.ts`'s `query_keys` field for
that event should be updated to hold the oRPC-generated key
(`orpc.<x>.<y>.key()`), not a hand-named tuple, to keep the single-source-of-truth
property intact.

---

## 6. Smoke-test pattern for Seam 3

`vendor/orpc/apps/content/docs/advanced/testing-and-mocking.md:1-24` is the
dedicated doc page. Its recommendation, verbatim in intent: "For fast, focused
tests, use Server-Side Clients or call your procedures directly with `call`.
This lets you verify validation, middleware, and handler logic without going
through HTTP" — exactly Seam 3's ask (unauthenticated call rejected, malformed
input rejected before business logic, no HTTP layer involved). Its example:

```ts
import { call } from '@orpc/server'

it('lists planets', async () => {
	await expect(
		call(router.planet.list, { page: 1, size: 10 })
	).resolves.toEqual([...])
})
```

This repo's test conventions (`src/server/article/lifecycle-rules.test.ts`,
`src/server/article/article-queries.test.ts`) use `vitest`'s `describe`/`test`/
`expect` directly, with `test.each` for status-matrix cases — no custom test
harness or mocking framework. Adapted:

```ts
// src/server/orpc/article/procedures.test.ts
import { describe, expect, test } from "vitest";
import { call, ORPCError } from "@orpc/server";
import { archiveArticle } from "./procedures";

describe("archiveArticle", () => {
	test("rejects an unauthenticated call", async () => {
		// requireAuth (§2) calls getServerAuthSession(), which reads Next's
		// headers() — call() still needs the { headers } initial context
		// satisfied per context.md's "initial context must be passed when
		// calling" rule; a bare/empty Headers object here yields no session.
		await expect(
			call(archiveArticle, { article_id: "not-a-uuid-but-irrelevant-here" }, {
				context: { headers: new Headers() },
			}),
		).rejects.toThrow(ORPCError);
	});

	test("rejects malformed input before reaching business logic", async () => {
		await expect(
			call(archiveArticle, { article_id: 123 } as never, {
				context: { headers: new Headers() },
			}),
		).rejects.toThrow();
	});
});
```

The initial-context-must-be-passed requirement above is documented at
`vendor/orpc/apps/content/docs/context.md:20-36` ("When a procedure requires
initial context when calling, you must manually pass it"). The two assertions
map 1:1 onto Seam 3's stated acceptance bar: an unauthenticated `call()` throws
(caught by `requireAuth`'s `ORPCError('UNAUTHORIZED')`, §2) before the handler
runs, and malformed input throws from `.input()`'s Standard Schema validation
before the handler runs either — `vendor/orpc/apps/content/docs/procedure.md:1-3`
frames "input validation, output validation, and middleware application" as
processed in the procedure pipeline ahead of `.handler`, and
`vendor/orpc/apps/content/docs/advanced/testing-and-mocking.md:7` states plainly
that `call()` exercises "validation, middleware, and handler logic" as one
pipeline, so a validation failure never reaches `archiveArticle`'s
`archive_article(input)` delegation.

Do not reach for `implement()`/mocking
(`vendor/orpc/apps/content/docs/advanced/testing-and-mocking.md:26-46`) for this
seam — that's for stubbing a procedure *out* when testing something that
depends on it, not for testing the procedure itself.

---

## 7. Gotchas, version caveats, footguns

- **The whole oRPC v2 surface used above is still on the `@beta` npm dist-tag.**
  Every single install command across the docs I read installs
  `@beta`: `@orpc/client@beta` (`vendor/orpc/apps/content/docs/client/client-side.md:11-27`),
  `@orpc/tanstack-query@beta` (`vendor/orpc/apps/content/docs/integrations/tanstack-query.md:14-30`),
  `@orpc/next@beta` (`vendor/orpc/apps/content/docs/integrations/next.md:10-26`),
  `@orpc/zod@beta` (`vendor/orpc/apps/content/docs/integrations/zod.md:14-30`).
  The submodule's own root `package.json` pins `"version": "2.0.0-beta.18"`
  monorepo-wide (checked directly, not inferred). Treat this as: the entire
  plan above targets a pre-1.0-of-v2 API surface, not a settled major. ADR-0002
  already accepts this tradeoff explicitly ("oRPC is newer/less battle-tested
  than tRPC — accepted", `docs/adr/0002-orpc-not-server-actions.md:72-73`), but
  it's worth restating concretely here: pin exact versions (not `^2.0.0-beta.18`)
  when this actually gets installed, since beta-to-beta bumps can carry breaking
  changes with no major-version signal to catch them.
- **`RPCHandler` auto-enables a CSRF guard for HTTP requests**, rejecting
  requests whose `Sec-Fetch-Mode` is `navigate`, `no-cors`, or `websocket`
  (`vendor/orpc/apps/content/docs/plugins/csrf-guard.md:1-33`,
  `vendor/orpc/apps/content/docs/rpc/handler.md:161-172`). This only applies to
  the HTTP mount (`src/app/api/orpc/[[...rest]]/route.ts`) — the direct
  server-side `createRouterClient` call from RSCs (§4) never goes through
  `RPCHandler` at all, so this guard is irrelevant there. Worth knowing so a
  future debugging session doesn't chase a phantom CSRF rejection on the RSC
  path — it categorically cannot happen there.
- **Router-and-procedure-level middleware can double-run.** If `router.ts`
  applies `authed` at the router level *and* an individual procedure module
  also applies it, `vendor/orpc/apps/content/docs/router.md:43-45` flags this
  explicitly as a performance foot-gun, pointing at
  `vendor/orpc/apps/content/docs/best-practices/dedupe-middleware.md` (already
  covered in §2). Decide once where `authed` is applied — recommend at the
  individual procedure level (`article/procedures.ts` exports procedures built
  from `authed`, not `base`), since not every future procedure will need auth
  (a future read-only procedure might legitimately be public), and applying it
  procedure-by-procedure keeps that an explicit per-procedure choice rather
  than an opt-out from a router-wide default.
- **`.input`/`.output` schema stacking requires loose objects.**
  `vendor/orpc/apps/content/docs/procedure.md:83-85`: stacked schemas must all
  accept unknown properties (`z.looseObject`, not `z.object`) or a later stack
  layer will reject fields the earlier layer allowed. Not currently relevant —
  §3 established no validator in this repo needs stacking today — but worth
  keeping in mind if a procedure input is ever composed from more than one of
  the existing `*_validator` exports.
- **Getting Started page is a stub.** `vendor/orpc/apps/content/docs/getting-started.md`
  is literally `// TODO` in the vendored source — there is no canonical "hello
  world" walkthrough to fall back on if the specific pages cited above turn out
  to be insufficient; the individual reference pages (`procedure.md`,
  `router.md`, `middleware.md`, `context.md`) are the actual source of truth,
  which is what this document draws from throughout.
- **`RouterClient<typeof router>` type export pattern.** Not used in the sketches
  above since the server-side-direct-call approach (§4) never needs a typed
  remote client for RSCs, but if a browser-side client is ever added for pages
  that must fetch client-side, `vendor/orpc/apps/content/docs/client/client-side.md:47-49`
  recommends exporting `RouterClient<typeof router>` from the server module
  rather than importing the router type directly into client code, to avoid
  accidentally bundling server-only imports.
