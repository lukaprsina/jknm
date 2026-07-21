# oRPC for the API transport, not Server Actions

**Status: decided, not yet implemented.** Nothing in this ADR describes current code.
See `docs/architecture.md` for what actually ships today.

> **Correction (2026-07-21).** The original version of this ADR said oRPC "replac[es] tRPC"
> and rejected Server Actions as a hypothetical. Both were wrong about the baseline: tRPC had
> *already* been removed from the repo, and Server Actions + TanStack Query is what has been
> shipping ever since. The decision below still stands, but the rationale and the trigger have
> been reworked to argue against the real status quo rather than a stale one.

The rewritten backend will use **oRPC + `@orpc/tanstack-query`** as its transport. Server
Components call the *same* procedures server-side for public/SEO pages; forms use TanStack Form.

## Baseline: what we're actually choosing against

Today there is no typed RPC layer at all. Writes are module-level `"use server"` Server Actions
imported directly and wrapped in `useMutation`; reads are mostly RSC calling Drizzle, with
client-side TanStack Query in only two components. `run_authorized_mutation` is a hand-rolled,
single-purpose auth guard. Query keys and cache invalidation are ad-hoc, hand-written at each of
~12 call sites — and every mutation fires *both* `invalidateQueries` and
`revalidateTag`/`revalidatePath` by hand.

That baseline has one genuine strength worth stating plainly: **Server Actions give end-to-end
type safety with a near-zero interface.** You import a typed function; there is no router, no
client proxy, no handler to mount. Any RPC layer is a step *down* in call-site ergonomics.

## Why oRPC anyway

The reason is **not** OpenAPI (not needed — no second client, no public API) and **not**
portability on its own (real, but dormant value that only pays out if the TanStack Start rewrite
in ADR-0001 actually happens).

The reason is that we need three things *regardless* of transport, and hand-rolling all three
produces worse versions of what oRPC ships as features:

1. **Declarative input validation** at the mutation boundary — currently absent.
2. **Composable middleware** for auth/logging — currently one fixed guard that can't compose.
3. **Query-key and options conventions** — currently 12 bespoke, hand-maintained call sites.
   This is what `@orpc/tanstack-query` exists to standardize.

Portability is then a free side effect rather than the justification: procedures + Drizzle move
to a TanStack Start rewrite nearly verbatim, whereas Server Actions are the most Next-locked
primitive available.

## When: with the caching/structure rewrite, not before

**This is deliberately not a standalone ticket.** The work that removes `unstable_cache` and
restructures the server folder layout already has to touch the read paths, the call sites, and
the invalidation story — which is precisely oRPC's surface area. Landing oRPC separately means
restructuring those same ~12 call sites twice.

Sequencing constraint: **better-auth (#6) lands first**, so oRPC's auth middleware is written
once against its final dependency instead of against NextAuth and then rewritten.

## Considered Options

- **Keep Server Actions, add hand-rolled glue** (zod at the `run_authorized_mutation` choke
  point, plus a query-key module) — the honest alternative, and only ~30 lines. Rejected *not*
  because it's unworkable but because it's throwaway: if oRPC is the destination, this rebuilds
  a worse version of it and then gets unwound, paying for the same call-site restructuring twice.
  **If the TanStack Start rewrite is ever formally abandoned, this option becomes the right
  answer and this ADR should be revisited.**
- **Next Server Actions + Cache Components as the strategic choice** — the framework-native path.
  Rejected: Server Actions are POST-only mutation primitives and poor as a query mechanism, and
  the whole surface is Next-locked in a repo whose stated destination is TanStack Start.
- **Adopt tRPC (again)** — rejected: superseded by oRPC (OpenAPI, cleaner typesafety, first-class
  TanStack Query), and it was already removed once.

## Consequences

- oRPC is newer/less battle-tested than tRPC — accepted for a solo maintainer already betting on
  TanStack Start.
- Call sites get *more* ceremonious than importing a server action. This is a real regression in
  ergonomics, accepted in exchange for the three capabilities above.
- Data logic stays in framework-agnostic modules (`lifecycle-rules.ts`, `reconcile-media.ts`,
  `article-queries.ts`), which is what keeps the ADR-0001 rewrite cheap to reach. Note this is
  *already true* today — it is not a benefit oRPC adds.

_Original rationale: wayfinder ticket #7 (github.com/lukaprsina/jknm/issues/7). Next.js facts
verified against installed 16.2.10 bundled docs._
