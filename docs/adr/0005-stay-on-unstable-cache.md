# Stay on `unstable_cache`; do not adopt Cache Components

**Status: decided, in effect now.** This describes current code, not a future step.

The app keeps using `unstable_cache` at its five cache sites. Next 16's Cache Components
(`cacheComponents: true` + `use cache` / `cacheTag` / `cacheLife`) is **rejected for now**,
despite `unstable_cache` carrying a deprecation note.

Full evidence, cited to first-party sources, is in `docs/research/nextjs16-caching-verdict.md`.
This ADR records the decision so the question is not re-opened every time the deprecation
warning is noticed.

## Why

**On Vercel, migrating correctly costs money to get back to where we already are.** `use cache`
is in-memory and therefore ephemeral in serverless environments — Next's own reference and
Vercel's own documentation both say so explicitly. Today's `unstable_cache` calls are durable
on Vercel for free, via the Data Cache. A naive port to `use cache` would be a *regression*,
and the non-naive port (`use cache: remote`, backed by the metered Vercel Runtime Cache)
introduces billed usage, a 2 MB per-item cap, and a network hop that `unstable_cache` does not
impose. For a low-traffic club news site, paying for a cache tier to reach parity is the wrong
trade.

**The deprecation is not a removal commitment.** Nothing in Next's documentation states a
removal version or a support horizon for the pre-Cache-Components model; a
"caching-without-cache-components" guide is maintained alongside it. The pressure to migrate is
rhetorical, not scheduled.

**`cacheComponents` is site-wide, not per-site.** Enabling it flips PPR on for the whole app
and forces Suspense rework — notably the auth session read on the homepage — plus a
`generateStaticParams` build error and loss of edge-runtime support. The blast radius is the
entire app, for a change whose benefit is zero at current traffic.

**It contradicts ADR-0002's own reasoning.** That ADR rejects Server Actions partly because
"Server Actions / RSC / Cache Components are the most Next-locked primitives and would be ~100%
throwaway" if the TanStack Start rewrite (ADR-0001) ever happens. Adopting Cache Components
would deepen exactly the lock-in that argument is built on.

## Considered Options

- **Option A — adopt Cache Components.** Rejected on the four grounds above. Its one genuine
  advantage is real and worth recording: `use cache` serializes via React Flight rather than
  `JSON.stringify`, so it structurally cannot have the `Date`-mangling bug that
  `src/lib/revive-cache-dates.ts` exists to work around. That workaround is the standing price
  of this decision.
- **Option C — delete app-level caching entirely and lean on ISR/CDN.** Not rejected on the
  merits, and defensible at this traffic. Not chosen because it is a larger behavioural change
  than the problem warrants, and because #31 needs the tags to exist in order to consolidate
  invalidation around them.
- **A custom cache handler.** Rejected: operational surface with no owner, to solve a problem
  that is not currently felt.

## Consequences

- `src/lib/revive-cache-dates.ts` stays. It is not dead code and should not be "cleaned up" —
  it is load-bearing for as long as this ADR stands.
- The deprecation warning on `unstable_cache` is **expected**. Seeing it is not a reason to
  re-open this.
- #31 consolidates cache *invalidation* — it does not change the caching primitive. Any spec
  that proposes replacing `unstable_cache` is out of step with this ADR.
- The declared tags remain the caching contract — a sixth (`article`) was added after this ADR
  landed, when the `article`-tag caching described in `docs/architecture.md` shipped; see
  [ADR-0006](0006-no-isr-on-article-pages.md). The count changes, not the argument above.

## What would change the answer

- **The Hetzner/Kamal move (ADR-0004, currently deferred/not the current plan — see its status
  header) actually happening.** Self-hosted, `use cache` persists
  across requests with no metering — the central cost argument evaporates and Option A becomes
  attractive. This is the most likely trigger.
- Next committing to a removal version for `unstable_cache`.
- Traffic growing enough that caching behaviour is felt at all.
- Abandoning the TanStack Start destination, which would retire the lock-in objection.
