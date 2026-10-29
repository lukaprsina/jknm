# Vercel Hobby "Active CPU" investigation (jknm)

Date: 2026-10-26. Read-only. Tags: **[O]** observed (tool + range given), **[I]** inference, **[X]** could not obtain.

## 0. Bottom line

- **[X] The billing-period Active CPU breakdown could not be retrieved on this plan.** Every Vercel API that holds per-route, per-UA, per-status, per-cache-status or per-day CPU data is gated behind a paid plan (details in section 1). So there is no per-route / bot / day breakdown below, only indirect evidence.
- **[O/I] Strongest finding:** the site is 100% dynamic SSR (no ISR/static pages), and production is being hit through hostnames the app rejects (`jknm-si.vercel.app`, `www.jknm.org`). Those requests still run the function and render an error 500 every time. Nothing is cached, so every crawler hit costs CPU.
- **[I]** 4 CPU-hours is 14.4M CPU-ms. Against ~36k bot requests/month (Cloudflare figure, from `docs/research/cloudflare-migration.md`) that is ~400 ms/request. This is high for one SSR render and suggests the Vercel-side request count is much larger than the Cloudflare zone's 36k (see section 3).
- **[I]** On Cloudflare Workers Paid the same CPU and request volume fits inside the $5 base plan (section 4).

## 1. What was and was not obtainable (Q1)

| Attempt | Result |
|---|---|
| `vercel whoami`, `vercel teams ls` (2026-10-26) | OK. User `lukaprsina`; one team `lukaprsinas-projects`, plan **hobby**. |
| `vercel project ls` | OK. 10 projects: `jknm` (updated 3h ago), `opb` (53d), `uozp-slovenski-svet` (147d), `cvinger` (155d), `jknm-convex` (156d), `roots-of-unity`, `upload-files`, `jknm-solid`, `max-flow-visualization`, `csz-converter` (157-161d). Only `jknm`, and maybe `opb`, have had recent activity, but their usage could not be measured. |
| `vercel usage` (cycle start to 2026-10-26), also `--group-by project` | **[X]** "Billing cost data is unavailable for 2026-10-01 through 2026-10-26" (Hobby has no cost data). |
| `vercel api /v1/billing/charges?from=2026-09-26&to=2026-10-27` and MCP `list_billing_charges` equivalent | **[X]** 404 "Costs not found". |
| `vercel metrics vercel.function_invocation.function_cpu_time_ms` (`-p jknm` and `--all`, 1d/7d/30d, with and without group-by) | **[X]** `payment_required`: "Observability Plus is required for this query". The metric exists and has dimensions routes/requestPath/clientUserAgent/httpStatus/functionStartType/etc., but it is locked. |
| `vercel logs requests` (CDN request records, 24h) | **[X]** `plan_upgrade_required`: needs Observability Plus, and "the add-on cannot be purchased on Hobby" (Pro required). |
| MCP `get_runtime_logs` with `since: 7d` | **[X]** Hobby retains runtime logs for **1 hour** only. |
| `vercel logs` runtime, last 50 min | OK, **[O]**, see section 2. Only console output is logged (errors); successful requests leave no line, so this is a biased sample. |
| MCP `create_observability_query` / `/v2/observability/query` | **[X]** 400/403 (scope shape; the real blocker is the Observability Plus gate). |

So these could not be answered with measured numbers: Active CPU hours, invocations, provisioned memory, Fast Data Transfer, image transformations, ISR reads/writes, function duration, per-route/UA/status/cache-state/day breakdown, and which of the 10 projects consumed the allowance. The user's own dashboard (Settings > Usage, or Team > Usage) is the only place on Hobby that shows the per-project totals. Suggested manual step: open `https://vercel.com/lukaprsinas-projects/~/usage`, filter "Fluid Active CPU" and view per project.

Other facts that are known:
- Builds do not count as Active CPU **[I, from Vercel docs knowledge; not re-verified here]**. Deployment history **[O]** (`vercel list jknm`, 2026-10-26): 8 deployments listed; 4 in the last day or so (3 failed production builds 20-120 s, 1 failed preview, 1 ready) and 3 older (56d). Build volume is small.
- Image optimization is not a factor: `next.config.ts` has `images.unoptimized: true` **[O, file]**.
- `/media/*` and `/img/*` are external rewrites to Backblaze B2 (`next.config.ts`). Rewrites to external origins do not execute a function on Vercel **[I]**, so they should not use Active CPU (they do use Fast Data Transfer / Fast Origin Transfer).
- Cron: `vercel.json` has one weekly cron (`/api/wake_supabase`, Mondays 00:00) doing a single DB query **[O, file]**. About 4 invocations/month, negligible.
- No `middleware.ts` or `proxy.ts` exists (`ls`, 2026-10-26), so no middleware CPU on static/bot requests.

## 2. Observed runtime-log sample (Q2, partial)

Source: `vercel logs -S lukaprsinas-projects -p jknm --since 50m --json`, window 2026-10-26 19:50:39Z to 20:40:39Z, 26 error log records **[O]**:

- All 26 are the same error: `Host "<x>" is not in the allowed hosts list. Allowed hosts: jknm.si, www.jknm.si, localhost:3000` (from the auth layer; HTTP 500 with a digest).
- Hosts: `jknm-si.vercel.app` (19), `www.jknm.org` (7). Paths: `/` (most), plus `/novica/stairway-to-heaven-prva-pripravljalna-akcija`, `/novica/na-prezimovaliscih-netopirjev`, `/novica/kanin-2020-naval-na-podgurko`, `/novica/jamarski-tecaj-2021-klubski-izpiti-in-caganka`, `/novica/misticna-bermuda`.
- Regions are spread across cle1, sfo1, iad1, pdx1, fra1, lhr1, sin1 (a distributed crawler or probe pattern, not a single human) **[I]**.
- All records are `environment: production`, `source: function`, `runtime: nodejs22.x`.

Interpretation **[I]**: `jknm-si.vercel.app` and `www.jknm.org` bypass the Cloudflare zone for jknm.si (and thus Cloudflare's bot counting) and still reach the Vercel production deployment. Each hit runs the Node function: cold start or session/DB work up to the host check, then a 500. Because the response is a dynamic 500, nothing caches it. This traffic would not appear in the "~36k bot requests on the zone fronting jknm.si" figure. Caveat: only 26 error logs in 50 min is too few by itself to account for 14.4M CPU-ms. Successful requests (which log nothing) are not counted, so the real rate is unknown.

Not testable (all **[X]**): sitemap/RSS, `/arhiv`, oRPC, admin endpoints, sharp ingest, preview deployments, spikes by day, UA bot-vs-human, cache status.

## 3. CPU per invocation vs. what the code does (Q3)

Code facts **[O, files]**:
- ADR-0006 (`docs/adr/0006-no-isr-on-article-pages.md`): `next build` reports all 18 routes as `ƒ (Dynamic)`; the 700 `/novica/[published_url]` pages are SSR on every request because the session is read via `headers()` (and a per-viewer archived gate). ADR-0005: data is cached with `unstable_cache` (Data Cache), the page render itself is not cached.
- Only `sitemap.ts` has `revalidate = 3600`. No middleware/proxy.
- Every request therefore runs a Node 22 function: React render of the article, session lookup (better-auth, DB call), `unstable_cache` reads. `docs/cache-invalidation.md` describes tag-based invalidation from admin mutations only (`updateTag`, `revalidateTag(..., "max")` from an internal route), so no revalidation storm pattern is visible in code; admin edits are rare.

Judgement **[I]**:
- Plausible per-request CPU for an uncached Next 16 article SSR: roughly 20-100 ms of Active CPU (render, RSC payload serialization, auth/DB driver work; awaiting the DB is not counted as active). I have not measured it. The 400 ms/request figure from the Cloudflare doc (14.4M ms over 36k requests) is therefore 4-20x higher than expected, so either (a) the Vercel-side request count is far larger than 36k (most likely: direct `*.vercel.app` hits, `www.jknm.org`, and RSC prefetch/`?_rsc=` requests, link prefetches from crawlers, none of which pass through the Cloudflare zone counter), or (b) some routes are much heavier (cold starts with large bundle/DB pool setup, `/arhiv` search, sitemap), or both.
- If the whole 4 h were spent at an assumed ~50 ms/request, that corresponds to ~290k invocations in the month **[I, arithmetic: 14.4M / 50]**; at ~20 ms it would be 720k. Either figure is much more than 36k, consistent with (a).
- Nothing anomalous was found in code (no cache-busting, no middleware, no cron storm). The anomaly is architectural: 100% of page traffic, including bots and error responses, is uncached SSR.

## 4. What this costs on Cloudflare Workers Paid (Q4)

Pricing from `~/code/repos/cloudflare/cloudflare-docs/src/content/docs/workers/platform/pricing.mdx` (Standard): $5/month base; 10M requests included then $0.30/M; 30M CPU-ms included then $0.02/M CPU-ms; cache hits and static assets do not cost CPU (footnote 3/4 and Example 5).

Using the worst case, i.e. the entire 4 Active-CPU-hours (14.4M CPU-ms) as Worker CPU **[I]**:
- CPU: 14.4M ms is below the 30M included, so $0 overage.
- Requests: anywhere from 36k to even ~1M requests is far below the 10M included, so $0.
- Total about **$5/month** (base subscription only). Even at 3x the CPU (43M ms) the overage would be (43.2M - 30M) x $0.02/M = about $0.26.
- Caveats: Vercel "Active CPU" and Cloudflare "CPU time" are similar (both exclude I/O waiting) but not identical, and a vinext/OpenNext port may spend different CPU per render. Neither was measured. The Free Workers plan (100k requests/day, 10 ms CPU cap per invocation) would be too tight for SSR at ~50+ ms.

## 5. Cheap mitigations on Vercel (state only, nothing applied) (Q5)

1. Stop the unused-host traffic: make `jknm-si.vercel.app` and `www.jknm.org` redirect to `https://jknm.si` (a `redirects` entry in `next.config.ts`/`vercel.json` with a `has` host condition) or return a cheap 308/404 before the app runs. Redirects at the routing layer cost no function CPU.
2. Add an `allowedHosts`-aware early exit so rejected hosts do not run the session/DB path.
3. Put a CDN cache on anonymous article HTML: `Cache-Control: s-maxage=...` / `stale-while-revalidate` for requests without a session cookie (ADR-0006 notes the blocker is per-viewer `headers()`, so this needs a cookie-keyed variant; larger change).
4. Vercel Firewall rule (Hobby supports basic custom rules) to challenge or deny known AI/SEO crawlers and user agents hitting `/novica/*`, and a `robots.txt` crawl-delay/disallow for aggressive bots.
5. Use the dashboard Usage view to confirm which project and routes dominate before changing anything; if `opb` or another project is the real consumer, the jknm-specific changes above will not help.

## 6. Open questions the user can answer from the dashboard

- Which project (jknm vs opb vs others) owns the Active CPU total.
- Whether Fluid Compute is enabled (affects how Active CPU is computed).
- Billing cycle start date (the CLI assumed 2026-10-01).

**Update 2026-10-26:** the user removed `jknm.org`, `www.jknm.org` and `jknm-si.vercel.app` from the Vercel project domains (the stray hosts were the suspected CPU drain; the ~36k Cloudflare bot figure likely belongs to the `jknm.org` zone, not `jknm.si`) — verify via the daily Active CPU graph over the next days.
