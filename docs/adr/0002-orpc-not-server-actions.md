# oRPC for the API transport, not Server Actions

The rewritten backend uses **oRPC + `@orpc/tanstack-query`** as its transport, replacing tRPC. Server Components call the *same* oRPC procedures server-side for public/SEO pages; forms use TanStack Form. Next.js 16 ships first-class Server Actions, so a reader would reasonably expect us to use them — we deliberately don't.

Three reasons: (1) it's faithful to the already-validated `jknm-convex` design, which is typed-RPC + TanStack Query (Convex functions consumed via `@convex-dev/react-query`) — the Drizzle translation of that is oRPC procedures, not Server Actions; (2) it keeps the up-to-spec frontend stable — TanStack Query and its hooks stay, and the admin editor's autosave/optimistic/filtered-table surfaces want a client cache that Server Actions/RSC serve poorly; (3) it's portable — oRPC procedures + Drizzle move to a future TanStack Start rewrite almost verbatim, whereas Server Actions / RSC / Cache Components are the most Next-locked primitives and would be ~100% throwaway.

## Considered Options

- **Next Server Actions + Server Components + Cache Components** — the framework-native path. Rejected: Server Actions are POST-only mutation primitives (poor as a query mechanism), Next 16 caching is the opt-in Cache Components model, and the whole surface is Next-locked. Would also be a larger frontend change than intended.
- **Keep tRPC** — rejected: superseded by oRPC (OpenAPI, cleaner typesafety, first-class TanStack Query), and the maintainer was already skeptical of tRPC.

## Consequences

- oRPC is newer/less battle-tested than tRPC — accepted for a solo maintainer already betting on TanStack Start.
- Data logic lives in framework-agnostic procedures, which is what makes the ADR-0001 rewrite cheap to reach.

_Full rationale: wayfinder ticket #7 (github.com/lukaprsina/jknm/issues/7). Next.js facts verified against installed 16.2.10 bundled docs._
