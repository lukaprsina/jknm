# Stay on Next.js for now; rewrite the backend in place

The maintainer prefers TanStack Start and dislikes Next.js, yet we are **staying on Next.js** and rewriting only the **backend** in place (Drizzle + Postgres/Supabase), keeping the existing frontend and EditorJS. The reason is triage, not preference: the article writers are in pain *now*, the frontend is up-to-spec, and every real defect is a backend leak — so the fastest path to a good product is to fix the backend on the framework that already ships, not to change frameworks.

The conditional TanStack Start rewrite is **deferred to a separate future effort**, to be reconsidered once the stabilized Next.js product can actually be judged.

## Considered Options

- **Rewrite to TanStack Start now** (the maintainer's framework preference; a half-finished `jknm-convex` prototype already exists at ~150h). Rejected for *timing*: it needs a few months minimum (700 articles with inline links, tables, B2 images, PDFs must keep working), while the writers need relief now. The preference is real and recorded — it just isn't this summer's job.

## Consequences

- Near-term work is scoped to the backend; the frontend and EditorJS are treated as fixed.
- Both eventual rewrite paths are TanStack Start, so the framework question is settled *for the rewrite too* — only the data layer (Convex vs Drizzle) stays open there.
- Investing in Next.js-specific code is accepted as potentially throwaway if the rewrite happens; see ADR-0002, which deliberately minimizes that throwaway.

_Full rationale: wayfinder ticket #2 (github.com/lukaprsina/jknm/issues/2)._
