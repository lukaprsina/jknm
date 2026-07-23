# Don't chase ISR on article pages

**Status: decided, in effect now.** #31's step 3 originally set out to enable it; this records
why that goal was abandoned rather than completed.

`/novica/[published_url]` — 700 article pages, the site's whole SEO surface — is not
static/ISR-cached, and reaching that state costs more than it is worth at this site's traffic.

## Why this needed deciding

#31 and `docs/research/nextjs16-caching-verdict.md` (§5 "Option C") both assumed the only
blocker was `Shell` reading the session unwrapped: Suspense-wrap that read, add
`export const revalidate` to the article page, done. That assumption was wrong for Next 16, and
#31 step 3 shipped the Suspense extraction anyway (real, portable-React value on its own) before
the ISR half turned out to be unreachable.

## Why it's blocked

A `<Suspense>` boundary only partitions a route into a static shell plus a dynamic hole under
**Partial Prerendering**. In Next 16, PPR has no standalone flag — it ships only as part of
`cacheComponents` (`cacheComponents.md`: *"cacheComponents implements Partial Prerendering (PPR)
as the default behavior… the `experimental.ppr` configuration flag and the `experimental_ppr`
route segment configuration are no longer necessary and have been removed"*). Without it,
`headers()` — which `getServerAuthSession` calls — opts the whole route into dynamic rendering
regardless of any Suspense boundary around it (`headers.md:48`).

Measured, not assumed: `next build` reports all 18 routes as `ƒ (Dynamic)` both before and after
the step-3 extraction. Temporarily stubbing the session read out of the shell entirely flips 7
routes to `○ (Static)` — proving the session read is the sole blocker for *those* routes. It does
not touch `/novica/[published_url]`, which has a second, independent blocker below.

**`/novica/[published_url]` reads the session a second time, directly, for `is_visible_to`**
(`archived` articles are visible to admins, 404 for everyone else — `CONTEXT.md`). That gate is
per-viewer. Serving the route from one shared static cache means every viewer gets the same
HTML, which is fundamentally incompatible with that gate as written — true with or without PPR.

## Considered options

- **Enable `cacheComponents`.** Makes the Suspense work pay off exactly as #31 imagined. Rejected
  by [ADR-0005](0005-stay-on-unstable-cache.md), and nothing about this decision changes that
  ADR's reasoning — its own "what would change the answer" section still governs.
- **Drop admin visibility of archived articles at the public URL**, moving that read-only preview
  behind `/uredi/[draft_id]`, which already gates published/archived content via
  `PublishedOrArchivedArticleGate` (currently a "create superseding draft" prompt, not a content
  view — extending it to render read-only content is the concrete follow-up if this is ever
  revisited). Rejected for now: a real behavior change to a working admin workflow, for a CDN/ISR
  win whose value is proportional to traffic this site doesn't have.
- **Accept no ISR; fix what ISR was actually protecting against instead.** Chosen. See below.

## What shipped instead

ISR's real motivation here was never SEO cache-hit ratio at this traffic — it was protecting a
pause-prone free-tier Supabase DB (`ADR-0004`) from load. Suspense-wrapping the session read
turned up that the *actual* uncached, doubly-queried read was `get_new_article_by_slug` itself
(`generateMetadata` and the page body each called it, uncached, every request). That's now fixed
directly: `cache()`-deduped per request, `unstable_cache`-backed across requests, invalidated
through the same `cache-policy.ts` seam as everything else (`article` tag, #31 step 1). See
`docs/architecture.md`'s Caching section for the mechanics.

That captures the DB-protection value ISR would have provided, at none of the cost above.

## Consequences

- User story 23 in #31 ("article pages… eligible for ISR") is **not satisfied** by this ticket.
- `nextjs16-caching-verdict.md` §5/§7 item 4 is corrected in place, not deleted, so the original
  (wrong) reasoning stays visible alongside the correction.
- `PublishedOrArchivedArticleGate` (`src/app/uredi/[draft_id]/page.tsx`) is the seam to extend if
  admin-visibility-at-the-public-URL is ever traded away for ISR.

## What would change the answer

- **The Hetzner/Kamal move ([ADR-0004](0004-self-hosting-hetzner-kamal.md), currently
  deferred/not the current plan) actually happening**, alongside revisiting
  [ADR-0005](0005-stay-on-unstable-cache.md) — the same
  trigger that would flip that ADR's answer flips this one too, since both gate on
  `cacheComponents`.
- **Traffic growing enough that DB load or cache-hit ratio is actually felt** — the `article` tag
  fix already covers the DB-protection half; what would remain is purely the CDN-edge argument,
  which is the weaker of the two motivations recorded here.
- **A product decision to drop admin preview of archived articles at the public URL**, made on
  its own merits rather than as a means to ISR.
