# Research: moving jknm from Vercel to Cloudflare Workers (vinext)

Date: 2026-10-26. Question: is `plan.md` (Vercel -> Cloudflare Workers Paid via vite-plus + pnpm + vinext, B2 -> R2,
sharp replaced) factually right, what breaks in this app, what does it cost, and in what order should it be tried?
Decisions already taken by the maintainer are not re-argued: keep Supabase/Postgres (D1 parked), B2 -> R2, toolchain
settled, new repo then diff, stale conversion scripts dropped, media-deletion cron / Editor.js->tiptap / Algolia->zbsearch parked.

Conventions. **[V]** = verified in a primary source (cited). **[I]** = inference, not directly stated by a source.
Source shorthands (all local shallow clones, fetched 2026-10-26):

- `CFD/` = `~/code/repos/cloudflare/cloudflare-docs/src/content/docs/` (partials in `.../src/content/partials/`)
- `VX/` = `~/code/repos/cloudflare/vinext/` (HEAD 39e5d9b, 2026-10-26)
- `VP/` = `~/code/repos/voidzero-dev/vite-plus/` (HEAD a9cc41d), `WS/` = `~/code/repos/cloudflare/workers-sdk/`,
  `CTR/` = `~/code/repos/cloudflare/containers/` (newly cloned, `@cloudflare/containers` 0.3.7)
- Repo paths without a prefix are in `/home/luka/code/js/jknm`.

---

## 0. Bottom line

1. The plan is mostly right. Corrections: `cf` is **beta** and does not yet "subsume" Wrangler; vinext is **recommended by Cloudflare but labelled beta**;
   "vinext doesn't run sharp" is really "workerd can't load native addons" (see 1).
2. The two real blockers are not in `plan.md`: **`jknm.si` DNS is not on Cloudflare** (NS = afraid.org / he.net, checked with `dig` today), and
   **sharp/googleapis/`dns.lookup` code paths** that will not run or fit on Workers.
3. The sharp problem mostly disappears if originals go to R2 and variants are made **at read time** with Cloudflare Images (`/cdn-cgi/image`).
   Today's write-path variants are never read by any renderer (verified by grep, see 4.1), so nothing is lost.
4. Cost: the whole thing fits in the $5 base plan with large headroom (6). The napkin math to double-check is not the Workers bill, it is
   *why* Vercel counted 4 CPU-hours (14.4M CPU-ms) from ~36k bot requests (that is ~400 ms/request, implausible for SSR alone).
5. Caching: keep `unstable_cache` (ADR-0005 still holds), but on Workers it needs a persistent adapter (KV or Response Store) or invalidation will not cross isolates (2.3).

---

## 1. Plan claims verified

| Claim in plan.md | Verdict | Evidence |
| --- | --- | --- |
| VoidZero acquired by Cloudflare | **True** [V]. Announced 2026-06-04; Vite, Vitest, Rolldown, Oxc, Vite+ stay MIT/open source; $1M Vite ecosystem fund. | https://blog.cloudflare.com/voidzero-joins-cloudflare/ ; https://voidzero.dev/posts/voidzero-cloudflare ; https://vite.dev/blog/cloudflare-supports-vite |
| vite-plus is v1.4.0 | **True** [V]. `vp --version` = v1.4.0; `VP/packages/cli/package.json` `"version": "1.4.0"`, license MIT. | local `vp`, `VP/packages/cli/package.json` |
| `vp` manages other package managers as shims | **True** [V]. `vp env` "Manage Node.js and package managers"; `vp -h` output; `vp` reports "Package manager pnpm v12.15.0". | `vp -h`, `VP/README.md` |
| pnpm "v12 now, oxidized with rust" | **True** [V]. pnpm 12.0 stable 2026-08-26, "a rewrite of pnpm in Rust". Caveat: npm `latest` tag still points at pnpm 11; install via `latest-12`. This repo already pins `packageManager: pnpm@12.15.0`. | https://pnpm.io/blog/releases/12.0 ; https://pnpm.io/blog/whats-different-in-pnpm-12 ; `package.json` |
| `cf` CLI "new cli subsuming wrangler. rip." | **Overstated** [V]. `cf` = one CLI for the whole public Cloudflare API (>2,900 commands) plus Workers project commands (`cf init/dev/build/deploy`, typed `cloudflare.config.ts`, "modes" instead of `--env`). Badge: **Beta** (`cf --version` = 1.0.0-beta.23). Wrangler is still maintained (WS wrangler 4.153.0) and used for `wrangler.jsonc` projects; `cf dev/build/deploy` in an unmigrated Wrangler project can rewrite files, so `cf migrate` first. Cloudflare Vite plugin used underneath is `2.0.0-beta.v.5`. `cf` does not support Bun. | `CFD/cf/index.mdx`, `CFD/cf/wrangler/index.mdx`, `CFD/cf/get-started/index.mdx` (Bun not supported), `WS/packages/wrangler/package.json`, `WS/packages/vite-plugin-cloudflare/package.json` |
| "cf CLI + vinext template" scaffolding | **Works, two routes** [V]. `vpx create-vinext-app@latest` (docs list a `vp` tab) or `pnpm create cloudflare@latest x --framework=next` (C3 "configures vinext"); for an existing app `vpx vinext init --platform=cloudflare`, which is non-destructive and adds parallel `*:vinext` scripts. `vinext init`/`create-vinext-app` use `cf` + `cloudflare.config.ts` by default; `--legacy-wrangler-cloudflare-init` keeps Wrangler. | `VX/README.md` (CLI reference), `VX/docs/getting-started/*.mdx`, `VX/docs/deploying/cloudflare.mdx`, `CFD/workers/framework-guides/web-apps/nextjs.mdx` |
| vinext is the recommended Next-on-CF path | **True, with "beta"** [V]. Cloudflare "recommends vinext as the default way to run Next.js on Workers"; OpenNext page: "Cloudflare recommends vinext instead of OpenNext for new Next.js applications". But the same page says "vinext is in beta. Before adopting it for an existing production application, run the compatibility check", and the vinext README says "not yet a drop-in replacement for every application or production workload". Package is `vinext@1.3.1`. | `CFD/workers/framework-guides/web-apps/nextjs.mdx`, `CFD/workers/framework-guides/web-apps/opennext.mdx`, `VX/README.md`, `VX/packages/vinext/package.json` |
| "vinext doesn't run sharp" | **Right conclusion, wrong layer** [V/I]. vinext README lists `sharp` among native modules that "can fail in Vite's RSC development environment". On Workers the real cause is that workerd runs JS/Wasm only [I: Workers docs list only Wasm for native code; no addon loading is documented]. sharp *would* run under vinext's Node/standalone target. | `VX/README.md` "Known gaps" |
| `unoptimized` images, Next 16 | **OK** [V]. `next/image` is "supported" in vinext's scanner; with `images.unoptimized: true` (this repo) vinext renders a plain `<img>` and skips optimizer and remote validation. | `VX/packages/vinext/src/check.ts` (next/image entry), `VX/packages/vinext/src/shims/image.tsx` (`_unoptimized`/`__globallyUnoptimized` branch, ~line 273) |
| "D1 instead of supabase" | Superseded by maintainer decision (keep Supabase; Hyperdrive). Not re-argued. | n/a |

Other plan statements checked: "$5/month Workers Paid" [V] (`CFD/workers/platform/pricing.mdx`: "$5 USD per month minimum").

---

## 2. vinext compatibility with this app

### 2.1 Inventory vs vinext support

Source for vinext status: `VX/packages/vinext/src/check.ts` (the scanner behind `vinext check`: IMPORT_SUPPORT / CONFIG_SUPPORT / LIBRARY_SUPPORT maps),
`VX/README.md`, `VX/docs/reference/differences.mdx`. Repo evidence from `src/`, `next.config.ts`, `package.json`.

| App feature (repo evidence) | vinext status | Notes / risk |
| --- | --- | --- |
| `next/image` x5 files, `images.unoptimized: true` (`next.config.ts`) | Supported [V] | Remote images: width+height -> `@unpic/react`; `fill` or dimensionless -> plain `<img>`; `loader`/`loaderFile` **config is ignored** (CONFIG_SUPPORT.images), per-component `loader` prop works (`shims/image.tsx:316`). `card.tsx` uses `fill` on a remote URL, so it is a plain `<img>` today and stays so. |
| `next/font/google` (Open_Sans) + `geist/font/*` (`layout.tsx`) | Partial [V] | Runtime CDN/`@font-face`, no self-hosting/subsetting/fallback metrics (README module table). Expect slightly more CLS; fonts load from Google CDN. |
| `unstable_cache` x6 sites + `revalidate-cache-dates.ts` | Supported [V] | `shims/cache.ts:681`; key = SHA-256 of `fn.toString()` + keyParts + args, so keys are **minification/build-sensitive** (comment at that site) => cache effectively cold per deploy. Entries are JSON in KV (`kv-data-adapter.runtime.ts` "Serialized cache value types") so the Date-mangling workaround stays necessary. |
| `updateTag` (ADR-0002, `src/server/cache-invalidation.ts`) | Supported, same rule as Next [V] | `shims/cache.ts:219`: throws unless called in a Server Action ("action" phase). Matches how this repo uses it. `revalidateTag(tag,"max")` from the route handler `/api/internal/revalidate` also exists (`shims/cache.ts:105`). |
| `revalidatePath("/")`, `("/sitemap.xml")` | Supported [V] | Edge purge limits apply (2.3). |
| `use cache` / `cacheComponents` | **Not used here; partially implemented in vinext** [V] | README "Known gaps": "`use cache` is partially implemented... full `cacheComponents` behavior is still incomplete" (cache profiles, tags, partial shells...). Custom `cacheLife` profiles ignored (CONFIG_SUPPORT). **Confirms ADR-0005: do not adopt on vinext.** |
| ISR / `export const revalidate` (only `sitemap.ts`: 3600) | Supported [V] | `docs/caching.mdx`; `dynamic = "force-dynamic"` on 7 routes is honored. |
| ADR-0006 (no ISR because `headers()` is read in the session helper) | Same behaviour in vinext [V] | `docs/caching.mdx`: `cookies()/headers()` make a route dynamic "while rendering" (not known at build), which also means vinext renders every layout on each navigation unless you export `dynamic = "force-dynamic"` from `layout.tsx` (`differences.mdx`, Caching). |
| Route handlers (`api/auth/[...all]`, `api/media`, `api/send`, `api/internal/revalidate`, `api/wake_supabase`, `si/route.ts`, `si/[...path]/route.ts`) | Supported [V] | `src/app/api/media/route.ts` starts with `"use server"` while exporting `POST`; legit-looking in Next, unusual; **spike** how vinext treats a `"use server"` route module. |
| oRPC `.actionable()` -> Server Actions (ADR-0002; `@orpc/next` 2.0.0-beta.46) | Server Actions supported [V]; `@orpc/next` untested [I] | `@orpc/next` imports `next/navigation` (see `vitest.config.ts` comment). Needs a spike; this is the highest-risk library in the app. |
| better-auth 1.7.1 (`src/server/auth`, `headers()` from `next/headers`) | Supported [V] | LIBRARY_SUPPORT: "uses only public next/* APIs (headers, cookies, NextRequest/NextResponse)". Drizzle: "works with D1 on Workers" and prisma via Hyperdrive; Drizzle+Hyperdrive documented by Cloudflare (3.4). |
| No `middleware.ts`/`proxy.ts` (architecture.md) | n/a | Both supported by vinext if later wanted. |
| `metadata`, `generateMetadata`, `sitemap.ts`, `robots.ts`, `manifest.ts`, file-based icons / `opengraph-image.png` | Supported [V] (Metadata API in README) | vinext streams metadata into `<body>` for a cache-miss render (`docs/caching.mdx` "Where generated metadata goes"); bots matched by `htmlLimitedBots` get it in `<head>`. Check SEO bots once (Google renders both). |
| `rewrites()` to B2 for `/media/*`, `/img/*`; `headers()` with host `*.vercel.app` | `rewrites`/`headers` supported [V] | External rewrite = Worker invocation + subrequest per asset hit. Better replaced (5.4). The `.vercel.app` noindex rule becomes a `*.workers.dev` rule (7.3). |
| `@vercel/speed-insights` (`layout.tsx`) | Renders client-side [V for @vercel/analytics; I for speed-insights] | Collects nothing off Vercel; replace with Cloudflare Web Analytics or drop. |
| `nuqs`, Radix, shadcn, react-hook-form, zod, `@t3-oss/env-nextjs` | Supported [V] | LIBRARY_SUPPORT lists all. |
| `next/dynamic` x2 (EditorJS loader, search) | Supported [V] | |
| Server Actions body limit `experimental.serverActions.bodySizeLimit: "100mb"` | Not in the scanner [I] | Workers memory is 128 MB (3.1): large buffered uploads must stream (4.4). |
| `react-instantsearch-router-nextjs` | Untested [I] | Uses `next/router`/`next/navigation` internals; spike. |
| `typedRoutes`, `reactCompiler` | Not set in `next.config.ts`; `babel-plugin-react-compiler` is a dependency | vinext enables the compiler via `vinext({ react: { compiler: true } })` (CONFIG_SUPPORT.reactCompiler). |
| `next/og`, `next/third-parties`, AMP, `after()` | Not used | `after` exists in vinext (README); `next/third-parties/google` unsupported. |

Run `vpx vinext check` in this repo first; it will print the authoritative list for the actual code.

### 2.2 Version drift to fix before migrating

`package.json` has `next 16.3.2`, `better-auth 1.7.1`, `eslint` + `biome` + `prettier` all together, `@biomejs/biome` while `docs/architecture.md` still says
Next 16.2.10 and better-auth pinned to 1.6.27 (architecture.md "Auth"). vinext "targets the stable Next.js 16 API surface" (`differences.mdx`).

### 2.3 Caching on Workers: what actually happens

- Default (no adapter) [V]: "No persistent cache - in-memory". `unstable_cache` and ISR live per isolate; an `updateTag` in the isolate that ran the action does not reach other isolates (`VX/docs/caching.mdx` Options table). **For this app that breaks read-your-own-writes in the admin flow described in architecture.md** (the stale-old-slug crash).
- Options [V] (`VX/docs/caching.mdx`): (a) **Workers Response Store** - Workers Cache + R2 for bodies + SQLite Durable Object for metadata/invalidation; "recommended", also holds the data cache (replaces `kvDataAdapter`), strongly coordinated per key; needs R2 + DO + second Worker or extra bindings. (b) Workers Cache + KV data. (c) KV only. (d) Static Assets (read-only, no runtime revalidation).
- KV adapter semantics [V] (`VX/packages/cloudflare/src/cache/kv-data-adapter.ts`): KV is eventually consistent; tag markers use KV default `cacheTtl` 60 s plus an in-memory 5 s tag cache, so a revalidation can be missed by another colo for roughly a minute. Entries default to a 30-day TTL.
- Edge purge [V]: `revalidatePath/Tag` send one batched Workers Cache purge per action using the **Free-tier purge rate limits** shared by every Worker in the account; failures are logged and the action still succeeds (stale edge copies persist until expiry). Routes with `dynamic = "force-dynamic"` skip the purge.
- **Recommendation [I]:** start with Response Store in *self-contained* mode (single Worker) for correctness of `updateTag`; fall back to KV only if DO/R2 costs or complexity bite. Keep `unstable_cache` + tags as is (consistent with ADR-0005: `cacheComponents` is incomplete in vinext, so migrating would be strictly worse).
- Public-page edge caching (new opportunity, [I]): Workers Cache bypasses on `Set-Cookie`/`Authorization` (`CFD/workers/cache/index.mdx`) and honors `Cache-Control`; vinext says a `Cloudflare-CDN-Cache-Control` provider header can select the shared policy for otherwise-dynamic responses "subject to admission safeguards" (`VX/docs/caching.mdx`). That could finally give anonymous visitors/bots cached `/novica/*` HTML (the thing ADR-0006 could not reach) while signed-in admins carry a session cookie. Unverified: needs a spike. Cache hits are billed as requests but cost zero CPU (`CFD/workers/platform/pricing.mdx` footnote 4).

---

## 3. Workers constraints for this app

### 3.1 Limits [V] (`CFD/workers/platform/limits.mdx`)
- Worker size **64 MiB uncompressed** (no compressed limit); startup (global scope) **1 s**; memory **128 MB**/isolate; CPU default 30 s per request (max 5 min) on paid; subrequests 10,000 on paid; 6 concurrent outbound connections; env var size 5 KB each; request body 100 MB on Free/Pro zones.
- **googleapis is 207 MB on disk** (`du -shL node_modules/googleapis`) and is imported as `import { google } from "googleapis"` in `src/server/author/sync_members.ts`. Tree-shaking the monolith is unreliable [I]; replace with the scoped `@googleapis/admin` package or a ~40-line `jose` service-account JWT + `fetch` to the Admin SDK (jose is already a dependency; `google-auth-library` is 1.1 MB).
- Drop `@aws-sdk/client-s3` (4.4 MB), `@aws-sdk/lib-storage`, `@aws-sdk/s3-presigned-post`, `b2-js`, `sharp`, `@types/node-dir`/`node-dir`/`glob`/`globby`/`csv-parse` from the runtime graph (script-only).
- `JKNM_SERVICE_ACCOUNT_CREDENTIALS` is base64 of a service-account JSON: verify it is < 5 KB (limit above) before assuming it fits as a plain var/secret [I].

### 3.2 nodejs_compat
`nodejs_compat` is **on by default for compatibility dates >= 2026-08-04**, and `process.env` is populated from vars/secrets for dates >= 2025-04-01 (`CFD/workers/runtime-apis/nodejs/index.mdx`, `.../process.mdx`). `src/env.js` (`@t3-oss/env-nextjs`, module-scope `createEnv`) should work; `NEXT_PUBLIC_*` must be inlined at build time by vinext [I - spike].

Not implemented: **`dns.lookup`** ("All node:dns functions are available, except lookup, lookupService, and resolve", `CFD/workers/runtime-apis/nodejs/dns.mdx`). `src/server/media/fetch-external-image.ts:67` calls `dns.lookup(..., {all:true})` for its SSRF check, so URL-import breaks. Workers cannot reach private ranges in the first place [I]; replace with: https-only, reject IP-literal/`localhost` hostnames, `redirect: "manual"` re-validation, byte cap while streaming (already present).

### 3.3 Memory on upload
`POST /api/media` does `request.formData()` then `Buffer.from(await file.arrayBuffer())` with `MAX_MEDIA_BYTES = 25 MiB`. That is 2-3 copies (~75 MB) in a 128 MB isolate [I]; stream straight to R2 (`bucket.put(key, request.body)`) or use a presigned/browser-direct PUT (4.4, 5.3).

### 3.4 Postgres via Hyperdrive [V] (`CFD/hyperdrive/...`)
- Drivers: node-postgres (`pg`) is "recommended... best compatibility with Hyperdrive's caching"; postgres.js >= 3.4.5 also supported (`partials/hyperdrive/node-postgres-recommendation.mdx`, `.../examples/connect-to-postgres/postgres-drivers-and-libraries/{drizzle-orm,postgres-js}.mdx`). Drizzle's documented path is `drizzle-orm/node-postgres`.
- **`src/server/db/index.ts` uses `postgres(url, { prepare: false })`**, which Cloudflare explicitly cautions against: "Do not use `prepare: false` with Postgres.js... queries can hang or fail intermittently" in Hyperdrive transaction pooling (`partials/hyperdrive/postgres-js-prepare-false.mdx`). (`prepare:false` exists today because of Supabase's transaction pooler.) So: switch to `pg` or postgres.js with prepare on, and give Hyperdrive the Supabase **direct** connection (Supabase docs and Cloudflare's supabase.mdx both say "use direct, not pooled", Hyperdrive pools).
- **Supabase direct connection is IPv6-only on the free/paid plan without the IPv4 add-on; the shared pooler is IPv4-only** (https://supabase.com/docs/guides/database/connecting-to-postgres, "Endpoints and IP versions"). Whether Hyperdrive reaches an IPv6-only origin is **not stated** in the Cloudflare docs I have (grep for "ipv6" in `CFD/hyperdrive` finds nothing) => open question / first spike. Fallback: Hyperdrive -> Supabase *session* pooler (IPv4, port 5432) [I, untested].
- Pool: ~20 origin connections on Free, ~100 on Paid per config; client max 5 per request recommended; `fetch_types:false` to save a round trip (`.../postgres-js.mdx`). Timeout: statements 60 s.
- **Hyperdrive query caching is ON by default (max_age 60 s) and "does not invalidate on writes"** (`CFD/hyperdrive/concepts/query-caching.mdx`). This app has `cookieCache` off on purpose and must read its own writes (sessions, drafts). Create the config with `--caching-disabled` (Cloudflare's own advice for auth/sessions/read-after-write), or two configs.
- Cost: paid plan = unlimited queries (`partials/workers/hyperdrive_pricing.mdx`).
- Cron: `vercel.json` keep-alive `/api/wake_supabase` weekly -> `triggers.scheduled(...)` in `cloudflare.config.ts` (`CFD/.../partials/workers/cloudflare-config.mdx`), which needs a custom Worker entry that re-exports vinext's fetch handler (pattern in `VX/examples/app-router-cloudflare/worker/index.ts`) plus a `scheduled` handler [I - vinext docs do not describe `scheduled`; the entry is a plain Worker module].

### 3.5 Algolia, Resend, OAuth
- `algoliasearch@5` has a `"worker"` export condition (`node_modules/algoliasearch/package.json` exports) [V]; server code uses it in `sync-algolia.ts`; client `react-instantsearch` is browser code.
- `resend` is fetch-based [I]; `@react-email/render` fine.
- Google OAuth + better-auth: only the redirect URI host changes; `baseURL.allowedHosts` must list every host that can start a sign-in, and Google needs each exact redirect URI (no wildcards) => previews on random `*.workers.dev` URLs cannot sign in (7.3).

---

## 4. Image / media ingest

### 4.1 Current state (verified in code)
- `src/server/media/ingest.ts`: sha256 dedupe, sharp sniff (`.metadata()`), uploads `original.<ext>`, then for **every** image: widths {400, 800, 1600} x formats {avif, jpeg} (only widths < original), a 16 px blur data-URI, rows written to `media.variants / srcsets / blur_placeholder` (`src/server/db/schema.ts:194-228`).
- **No reader exists**: `grep` for `srcsets|.variants|blur_placeholder` in `src/` outside `ingest.ts`/`schema.ts` returns only a comment in `api/media/route.ts`. Renderers use `media.original.url` (`new-card.tsx`, `published-article-page.tsx`) or the URL baked in `content_json` (`editor-to-react.tsx:295`). `next/image` runs `unoptimized`. So the maintainer's observation ("only half implemented") is more precisely: variants are generated for every image, but **nothing serves them**; articles and thumbnails both ship originals.
- `crop_image` (`src/lib/s3-utils.ts`, flagged `TODO: CRITICAL, SHARP`) also uses sharp, and per `TODO.md` custom thumbnail crop is a no-op end to end.
- Media is immutable and content-addressed (`Media.hash` unique, uuid key `<id>/original.<ext>`, `media_url(key)` = `MEDIA_CDN_ORIGIN/key`), which is exactly what read-time transforms want.

### 4.2 Option A - Cloudflare Images transformations (recommended)
Facts [V]:
- Two interfaces: URL `/cdn-cgi/image/<params>/<source>` on a zone with Transformations enabled, or the `IMAGES` binding (`env.IMAGES.input(stream).transform().output()`), configured with `bindings.images()` in `cloudflare.config.ts`.
- Billing: first **5,000 unique transformations/month included on Paid** then $0.50 / 1,000; unique = source x params, per calendar month; `format` and `quality` are **excluded** from uniqueness; repeats within the month are free; binding calls billed identically (`CFD/images/pricing.mdx`). Free plan: 5,000 unique/month then new transforms return 9422 (no charge).
- Limits for non-Images-stored sources: 100 MB file, 100 MP, 12,000 px (AVIF dimension limit 1,200 px listed), **AVIF input is Enterprise-only**; **binding `.input()` max 20 MB**; inputs: PNG, JPEG, GIF, WebP, SVG (not resized), HEIC; outputs include AVIF/WebP/JPEG (`CFD/images/get-started/limits.mdx`).
- Origins: by default only the **same zone** is an allowed source; other origins must be added under Images > Transformations > Sources (`CFD/images/optimization/transformations/sources.mdx`). Origin requests are anonymized (no cookies/auth).
- Responses from the binding are **not cached automatically**; enable Workers Cache and send `Cache-Control` (`CFD/images/optimization/binding.mdx`). The URL interface caches at the edge.
- Next.js: Cloudflare ships a custom loader for `/cdn-cgi/image/width=...,quality=.../<src>` (`CFD/images/optimization/transformations/integrate-with-frameworks.mdx`). In vinext the **config-level `loaderFile` is ignored**, so pass `loader=` per component (or a shared wrapper component) [V: check.ts + image.tsx:316]. vinext's own `/_next/image` optimizer with `imagesOptimizer()` (uses the `IMAGES` binding) only handles **local** images; remote ones go to `@unpic` or plain `<img>` (`check.ts` next/image detail, `VX/packages/cloudflare/src/images/images-optimizer.runtime.ts`).

Mapping to this app [I]:
- Put originals in R2 (5.x). Serve transforms from the **same zone as the media domain** (`gradivo.jknm.org` on the `jknm.org` zone, which is already on Cloudflare): `https://gradivo.jknm.org/cdn-cgi/image/width=800,format=auto/<uuid>/original.jpg`. Same-zone source needs no Sources config; enable Transformations on the `jknm.org` zone.
- Write path becomes: sniff type by magic bytes/`image-size` (pure JS, already a dependency), hash with `crypto.subtle`, `bucket.put`, insert row with `original` only. No variants, no srcset, no sharp. `variants`/`srcsets` columns stay unused (leave them, or drop in a later cleanup migration; do not make the migration depend on it).
- Render path: one small `media_image_url(original_url, width)` helper + a `loader` for `next/image`; because keys are immutable, `Cache-Control: immutable` is safe. Limit widths (`images.deviceSizes` is honored by vinext) so unique transformations stay low: cost = images touched per month x distinct widths. With ~1-3k originals (2 GB bucket, [I]) x 3-4 widths = 3-12k unique/month worst case if bots crawl everything => $0-$3.5/month.
- Blur placeholder: compute client-side at upload (tiny canvas -> data URI) or drop it (it is unused today).
- Crop: the editor already has `react-image-crop`; do the crop in the browser with canvas and upload the cropped blob. This fixes the no-op crop bug too.
- Loses: server-side format validation via a real decoder; use magic-byte sniffing + the transform endpoint's own rejection (9520 unsupported format) as the safety net.
- Does it remove the write path? Yes for resizing; you still need a write path for upload (R2 put + DB row), which is simple and Worker-native.

### 4.3 Option B - client-side resize (pica etc.)
- pica: browser resize with web workers + Wasm, tile-based to bound memory (default 1024), mks2013 filter; for Node "we strongly recommend sharp" (https://github.com/nodeca/pica README) [V].
- Encoding is the weak point: `canvas.toBlob` only guarantees `image/png`; `image/jpeg`/`image/webp` are "many" browsers; unsupported types silently fall back to PNG (https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob) [V]. AVIF output is not guaranteed in browsers [I]. Mobile browsers have canvas area/memory ceilings [I, not verified].
- Consequences: the editor uploads N variants per image from the user's machine (bandwidth, time, memory), variants for old/script-ingested images (`scripts/migrate-legacy-media.ts`, `rescue-stale-media.ts`) cannot be produced (no browser), and ingest becomes trust-the-client. Good for **crop and a 1600 px cap**, not as the variant pipeline.

### 4.4 Option C - Vercel Hono + sharp service in the monorepo
Facts [V] (Vercel docs): Hono deploys with zero config as a Vercel Function (https://vercel.com/docs/frameworks/backend/hono); monorepo = one Vercel Project per directory with Root Directory set, `vercel link --repo`, projects per git repo limited to 25 on Hobby / 150 Pro (https://vercel.com/docs/monorepos, https://vercel.com/docs/limits); a single entry (e.g. `api/index.ts` with a `fetch` export) is supported (https://vercel.com/docs/functions/runtimes/node-js). Function **request/response body limit 4.5 MB** (413 `FUNCTION_PAYLOAD_TOO_LARGE`) (https://vercel.com/docs/functions/limitations); Hobby includes 4 Active-CPU-hours and is "non-commercial, personal use only" (https://vercel.com/docs/plans/hobby).
Implications [I]:
- Possible technically, but the 4.5 MB cap means the Worker cannot POST multi-MB originals to it; it would have to pass an R2 presigned GET URL, return variants via presigned PUTs, plus a shared secret/HMAC or signed-JWT between Worker and service. That is a second platform, second deploy, second set of secrets, and it burns the *same* Hobby Active-CPU quota whose exhaustion started this migration. Not recommended.

### 4.5 Option D - Cloudflare Containers
Facts [V]:
- Billed per 10 ms active: Workers Paid includes 25 GiB-hours memory, 375 vCPU-minutes, 200 GB-hours disk per month; overage $0.0000025/GiB-s, $0.000020/vCPU-s, $0.00000007/GB-s; egress 1 TB included in NA/EU (`CFD/containers/platform/pricing.mdx`). Instance types: lite 1/16 vCPU 256 MiB; basic 1/4 vCPU 1 GiB; standard-1 1/2 vCPU 4 GiB (`CFD/containers/platform/limits.mdx`, partial `instance-types.mdx`).
- Cold start "often 1-3 s", scale to zero with `sleepAfter` (default 10 min) (`CFD/containers/concepts/architecture.mdx`, `faq.mdx`). Each container is a Durable Object; a Worker calls it via `env.MY_CONTAINER.getByName(id).fetch(request)` using `@cloudflare/containers` (`CTR/README.md`). Linux/amd64 Docker images; Docker must run locally/CI at deploy (`CFD/containers/get-started/index.mdx`). Previews do not support DO-managed Containers (`CFD/cf/projects/index.mdx:317`). Config: `defineContainer()` in `cloudflare.config.ts`; `cf migrate` does not convert Containers.
- sharp/libvips runs in any ordinary Node image on linux/amd64 [I; no Cloudflare statement needed].
- Cost for this app [I]: ~tens of uploads/month x ~10-70 s x `basic` (1 GiB, 1/4 vCPU) is well under the included 25 GiB-h / 375 vCPU-min => ~$0 incremental.
Verdict: viable *fallback* if server-side derivation is wanted later (HEIC from phones, EXIF auto-rotate baked in, deterministic AVIF). Costs: Docker in CI, container image management, Worker<->container plumbing, no preview support, 1-3 s cold start on first upload after idle. Not needed if Option A is adopted.

### 4.6 Recommendation (media)
**A + browser-side crop/resize cap (B-lite).** Originals to R2; variants at read time via `/cdn-cgi/image` on the media zone; ingest loses sharp; crop in browser. Keep D as the documented fallback; skip C. What must change in code: `ingest.ts` (drop sharp/variants/B2 client, use R2 binding + `image-size`), `s3-utils.ts` (`crop_image` removed, `list_objects`/`delete_objects` onto the R2 binding), `api/media/route.ts` (stream body, no `dns.lookup`), `fetch-external-image.ts`, `next.config.ts` (`images.unoptimized` stays true OR switch to per-component loader), `card.tsx`/`editor-to-react.tsx` (`loader` prop), `domains.ts` (`MEDIA_CDN_ORIGIN` unchanged on purpose), `env.js` (drop `AWS_*`/`NEXT_PUBLIC_AWS_*`).

---

## 5. B2 -> R2

### 5.1 ADR-0008 mapping
ADR-0008: `gradivo.jknm.org` is a proxied CNAME to `f003.backblazeb2.com` with a URL Rewrite Rule `gradivo-b2-rewrite` prefixing `/file/jknm-gradivo`. Every stored `content_json` URL and `media.original.url` is `https://gradivo.jknm.org/<uuid>/original.<ext>` (`media_url`). Under R2 a bucket attached as a **custom domain** serves `https://gradivo.jknm.org/<key>` directly [V: `CFD/r2/buckets/public-buckets.mdx`], so object keys are unchanged and **no stored URL changes**. Steps at cutover: remove the CNAME + rewrite rule, connect the bucket to the hostname (the domain must be a zone in the same account - `jknm.org` already is), keep `r2.dev` disabled. Note "You cannot create a Custom Domain on a hostname with an existing CNAME" is the Workers rule (`CFD/workers/configuration/routing/custom-domains.mdx`); for R2 the dashboard flow creates its own DNS record, so delete the old CNAME first [I].
- Caching: custom domains use Cloudflare Cache; "only certain file types are cached" by default (images are), `Cache everything` needed for others (PDFs, etc. are in `default-cached-file-extensions` - check); use Smart Tiered Cache (`public-buckets.mdx` Caching).
- ADR-0008's `vsebina.jknm.org` note is already dead infra.

### 5.2 Copying ~2 GB (+ `jknm-legacy`)
- **Super Slurper** (dashboard, one-off): B2 is a tested S3-compatible source; objects < 1 TB; non-destructive; overwrite or skip option (`CFD/r2/data-migration/super-slurper.mdx`). Best for a 2 GB bucket.
- **Sippy**: lazy copy on first miss from B2 into R2; combine with Super Slurper to avoid downtime (`sippy.mdx`). Probably unnecessary at 2 GB; useful if you cut over before the full copy ends.
- rclone as alternative (`CFD/r2/examples/rclone`).
- Run it for **both** buckets: `jknm-gradivo` (media) and `jknm-legacy` (2008-site `/media/*`, `/img/*`, referenced by `next.config.ts` rewrites; size unknown). B2 egress for the copy: Backblaze allows free egress up to 3x stored data per month [I, not re-verified].
- Verify by comparing object counts and the existing `media.hash` sha256 (hash column is exactly the integrity check), then flip DNS.

### 5.3 S3 API vs binding; uploads
- Prefer the **R2 binding** in Workers (`env.MEDIA.put/get/delete/list`): no SDK, no keys, streaming; this removes the 4.4 MB AWS SDK packages from the bundle. The S3 API (`CFD/r2/api/s3`) is for external tools/presigned URLs.
- Browser-direct upload (bypasses Worker memory and the 100 MB zone body limit) needs **presigned PUT URLs** generated with the S3 API credentials (use `aws4fetch`, not the full SDK) [I]; with R2 CORS configured (`r2/buckets/cors.mdx`). Simplest first version: keep multipart POST to the Worker and `bucket.put(key, file.stream())`, since the cap is 25 MiB (`MAX_MEDIA_BYTES`).
- The sweep script `scripts/sweep-stale-content.ts` (bun) deletes B2 objects through `delete_objects`; repoint it to R2 (S3 API via `aws4fetch`/rclone or an admin-only route using the binding). The media-deletion cron is parked per maintainer.

### 5.4 Legacy `/media/*` and `/img/*`
Replace the external `rewrites()` (Worker invocation + proxy fetch + zone cache semantics) with a route handler reading the `jknm-legacy` R2 bucket binding, `Cache-Control: public, max-age=31536000, immutable`, so paths on `www.jknm.si` stay byte-identical (the purpose stated in `next.config.ts`). Alternative: attach a custom domain to the legacy bucket and rewrite to it.

### 5.5 Pricing (R2) [V] `CFD/r2/pricing.mdx`
$0.015/GB-month beyond 10 GB free; Class A $4.50/M beyond 1M; Class B $0.36/M beyond 10M; **egress free**. 2 GB + legacy < 10 GB => $0. Custom-domain reads that hit Cloudflare's edge cache are not R2 operations [I].

### 5.6 What a correct image design looks like (summary)
Originals only in storage; immutable uuid keys; variants as a pure function of (key, width) computed at the edge on demand; dimensions + content type stored at ingest; widths whitelisted; thumbnails and in-article images use the same helper; no per-image derived DB state (the existing `variants/srcsets` JSON becomes dead weight). The "thumbnails only" observation is better described as "variants exist for everything but nothing reads them".

---

## 6. Pricing sanity check (Workers Paid)

Inputs: user says ~36k bot requests/month plus SSR and admin traffic. Prices [V] from `CFD/workers/platform/pricing.mdx` unless noted.

| Item | Included on $5 plan | Overage | This app (estimate) |
| --- | --- | --- | --- |
| Requests | 10 M/mo | $0.30/M | 36k bots + humans + redirects, say 150k-500k => $0 |
| CPU time | 30 M ms/mo | $0.02/M ms | SSR ~10-20 ms typical (`limits.mdx`: "10-20 ms" for SSR/auth) => 150k x 20 = 3 M ms => $0; at 1 M req x 20 ms = 20 M ms still inside |
| Static assets | free, unlimited | n/a | JS/CSS/public free; **bundle chunks under `/_next/static` skip the Worker** (`VX/docs/deploying/cloudflare.mdx`), but `public/` files go through the Worker unless excluded |
| Duration | no charge | n/a | n/a |
| Workers Cache hits | billed as requests, no CPU | | helps CPU not request count |
| KV (if used) | 10 M reads, 1 M writes, 1 GB | $0.50/M reads, $5/M writes | ~3-4 reads/request x 500k = 2 M => $0 |
| Durable Objects (Response Store) | 1 M req, 400k GB-s, 25 B rows read, 50 M rows written, 5 GB | $0.15/M req | well inside |
| R2 | 10 GB, 1M A, 10M B | see 5.5 | $0 |
| Hyperdrive | unlimited queries | n/a | $0 |
| Images | 5,000 unique/mo | $0.50/1,000 | $0-$4 (4.2) |
| Containers (only if Option D) | 25 GiB-h, 375 vCPU-min, 200 GB-h | see 4.5 | $0 |
| Workers Logs | 20 M events/mo | $0.60/M; **pricing changes Dec 1, 2026** to Observability pricing (`partials/workers/workers_logs_pricing.mdx`) | $0 but re-check after Dec 1 |
| Cron triggers | included | | 1 weekly invocation |

Expected bill: **$5.00/month**, headroom >= 10x. Total with Images worst case ~$8.

Things the napkin math may miss:
1. **Why 4 CPU-hours on Vercel?** 4 h = 14.4 M CPU-ms; 36k bot requests would mean ~400 ms CPU each. The cost is probably elsewhere: admin editor sessions (Server Actions, RSC navigation on a 18-route dynamic app with `prefetch`), Vercel image/RSC overhead, long Algolia/Drizzle serialization, or many more bot hits than 36k (`/si/*` legacy redirects, `/media`, `/img`, sitemap). Profile before assuming Workers repeats it. On Workers the same CPU-ms would still sit under the 30 M included [I] (CPU is measured excluding I/O wait on both platforms).
2. Requests that were free on Vercel's CDN become **Worker invocations**: `/media/*` + `/img/*` rewrites, `public/` files, `/si/*` redirects, `robots.txt`, `sitemap.xml`. Static-asset requests are free only when served by Workers Static Assets without invoking the Worker.
3. Workers Cache "hits count as requests" (footnote 4).
4. Cloudflare purge limits for revalidation are Free-tier limits (2.3).
5. `workers.dev` stays public unless disabled (7.3), and bots hit it too.
6. Observability pricing change Dec 1, 2026.
7. Domain: the `jknm.si` zone on Cloudflare Free is $0 but must be moved (7.1).
8. Preview deploys and CI minutes: GitHub Actions or Workers Builds (`CFD/workers/ci-cd`); not priced here.

---

## 7. Migration strategy and what the plan missed

### 7.1 Blocker the plan does not mention: DNS for jknm.si
`dig NS jknm.si` -> `ns2.afraid.org., ns3.he.net., ns2.he.net.` (free DNS hosts), `www.jknm.si` -> Vercel (`*.vercel-dns-017.com`); `jknm.org` is on Cloudflare (`alexandra/keanu.ns.cloudflare.com`). Workers **Custom Domains require an active Cloudflare zone** (`CFD/workers/configuration/routing/custom-domains.mdx`); a CNAME ("partial") setup is **Business/Enterprise only** (`CFD/dns/zone-setups/partial-setup/index.mdx`). So `jknm.si` must be delegated to Cloudflare nameservers (Free plan, full setup) by whoever controls the registrar/DNS ("the `jknm.si` DNS owner" in `docs/domain-cutover-checklist.md`), and mail/Resend records copied across. This is a human, calendar-bound step: start it first, with TTL lowered, and keep Vercel as the live origin until the Worker passes the checklist.

### 7.2 Concrete ordered checklist (spikes first, cheapest-to-fail first)
0. Pre-flight in the *current* repo (no code change in this research): `vpx vinext check`, list `unsupported/partial`; record `next build` route table and bundle size.
1. **New app**: `vpx create-vinext-app@latest jknm-cf` (or `pnpm create cloudflare@latest --framework=next`) under `~/code/js/`; deploy hello-world to Workers Paid on `*.workers.dev`; confirm `cf deploy`, `cf previews deploy`, `cf auth login` work from a clean machine and in CI (`CLOUDFLARE_API_TOKEN`).
2. **Spike A, DB**: Hyperdrive -> Supabase. Test (a) direct IPv6 host, (b) session pooler; `pg` + `drizzle-orm/node-postgres`, `--caching-disabled`; prepared statements on; read/write one `Article`; measure latency from Worker.
3. **Spike B, framework core**: copy `src/app/layout`, `provider`, shell, `/novica/[published_url]`, `src/server/{db,auth,orpc}`. Verify: better-auth Google sign-in (explicit `allowedHosts`, redirect URI for the `*.workers.dev` test host, cookies), oRPC `.actionable()` mutation + `updateTag`, `next/font`, metadata/sitemap/robots, `"use server"` route module (`api/media`).
4. **Spike C, caching**: Response Store (self-contained) vs KV: publish an article, then immediately load the old and new slug from a second region/session; confirm `updateTag` read-your-own-writes; check Date revival; confirm cold-deploy behaviour (`fn.toString()` keys).
5. **Spike D, public caching**: `Cloudflare-CDN-Cache-Control` on `/novica/*` and `/`; verify admin cookie bypass and no `Set-Cookie` leakage.
6. **Spike E, media**: R2 bucket + custom domain on a *test* hostname; ingest via binding; `/cdn-cgi/image` on `jknm.org` zone; per-component `loader`; check the Images quota counter. Upload 25 MB image: memory and CPU.
7. **Spike F, bundle**: `googleapis` replacement; confirm Worker size < 64 MiB and `startup_time_ms` < 1 s (`wrangler`/`cf` deploy output).
8. Data copy: Super Slurper B2 -> R2 for `jknm-gradivo` and `jknm-legacy`; verify counts and `media.hash`.
9. DNS: delegate `jknm.si` to Cloudflare (7.1), recreate records (MX, SPF/DKIM, TXT verifications) before NS switch.
10. Port: new branch in this repo; apply the diff of the starter vs this repo (user's plan); remove Vercel files (`vercel.json`, `@vercel/speed-insights`, `.vercel.app` header rule); replace B2/AWS env; add `scheduled` keep-alive.
11. Staging deploy on `staging.jknm.si` (or Preview) with a staging DB branch (`db:push:staging` exists), run `docs/domain-cutover-checklist.md` equivalents.
12. Cutover: attach Worker custom domains `jknm.si` + `www.jknm.si`, update Google OAuth redirect URIs (`https://www.jknm.si/api/auth/callback/google`), set `NEXT_PUBLIC_DEPLOYMENT_ORIGIN`, flip R2 custom domain on `gradivo.jknm.org`, remove old B2 rewrite rule. Keep Vercel deployment warm for rollback ~1-2 weeks.
13. Post-cutover: Search Console crawl stats, watch Workers metrics (CPU, errors `exceededCpu`/`exceededMemory`), disable `workers.dev`, retire B2 after verifying.

### 7.3 Other items the plan misses
- **Previews/OAuth**: Google OAuth needs exact redirect URIs; per-PR preview URLs will not support sign-in unless you use one fixed preview hostname. `cf previews deploy <name>` gives a named Preview (`VX/docs/deploying/cloudflare.mdx`). Previews do not use cache warming or version promotion.
- **`*.workers.dev`**: publicly reachable duplicate site; replace the `*.vercel.app` noindex header rule or disable the workers.dev route (`CFD/workers/configuration/routing/workers-dev.mdx`).
- **Env/secrets**: no `vercel env`; use `cf`/dashboard secrets and `.dev.vars`/`.env.local` for dev. `src/env.js` requires 12 server vars to exist at import time; `skipValidation` needs `SKIP_ENV_VALIDATION=1` during build.
- **Observability**: Workers Logs/Traces; `@vercel/speed-insights` replaced by Cloudflare Web Analytics; Sentry integration is only "partial" in vinext.
- **Vercel-specific code is small**: `@vercel/speed-insights` (`layout.tsx`), `vercel.json` cron, `.vercel.app` header rule in `next.config.ts`, comments about `VERCEL_URL`. No `@vercel/blob`/`kv`/`og` usage found.
- **Cron**: weekly `wake_supabase` stays relevant while on Supabase Free (pause-on-inactivity per ADR-0004).
- **`after()`/background work**: none used; Algolia sync is awaited in the mutation path; if moved to `ctx.waitUntil` remember the 30 s cap (`limits.mdx`).
- **ADR-0004 (Hetzner/Kamal)**: already marked superseded/on hold; the migration formally supersedes it. Its remark that self-hosting "removes the `use cache` persistence problem" has an analogue on Workers: Response Store/KV adapters give `unstable_cache` persistence without metering concerns, but `cacheComponents` is still incomplete in vinext, so ADR-0005's verdict stays "stay on `unstable_cache`".
- **Scripts using bun** (`scripts/*.ts` headers say `bun run ...`, `README`/`CONTEXT.md` `bun run sweep`): scripts do not ship to the Worker, so they survive, but `cf` does not support Bun and `package.json` already runs them with `tsx`/`vpx`; unify on `vpx tsx` or `vp run`. `scripts/*` that use `sharp` or the B2 client (`migrate-legacy-media.ts`, `rescue-stale-media.ts`) are stale with the plan and should be deleted in the new branch; `scripts/sweep-stale-content.ts` is kept and repointed.
- **Tooling gaps when dropping eslint/prettier/biome for oxlint/oxfmt** [I]: `eslint-plugin-drizzle` (unsafe delete/update without where) and `@next/eslint-plugin-next` have no known oxlint equivalent; check coverage before deleting `eslint.config.mjs`.
- **vitest**: `vitest.config.ts` inlines `@orpc/next`; tests mock `next/cache`; keep Vitest via `vp test`. `@electric-sql/pglite` tests are Postgres-based and survive the keep-Supabase decision.
- **`backup-db.ps1`** is a Windows script; DB backups stay a Supabase concern.

### 7.4 Risks (ranked)
1. DNS ownership/delegation of `jknm.si` (7.1) - blocks cutover.
2. oRPC `@orpc/next` beta + Server Actions on vinext - blocks mutations if it fails.
3. Hyperdrive reachability of Supabase (IPv6) and `prepare:false` hangs.
4. Cache invalidation correctness (2.3) and Worker bundle/startup limits (3.1).
5. vinext beta: new releases weekly (`VX/packages/vinext/CHANGELOG.md`, 1.3.1); pin versions, keep `next build` path alive on the branch until cutover (vinext init is non-destructive).
6. SEO regressions: metadata placement for streamed misses, status codes (`resolve_slug_request` contract in architecture.md), redirects from `/si/*`.

---

## 8. Stale docs / ADRs invalidated

| File | What goes stale |
| --- | --- |
| `CONTEXT.md` "`jknm-convex` - the reference design" | References `D:\dev\js\jknm-convex`, a Windows path to a sibling repo that no longer exists on this machine; delete the section (the design it describes is already ported). Also says "`bun run sweep`" and "Algolia replicas"/"Drizzle/Postgres and EditorJS stay" (still true). |
| `docs/adr/0001-stay-on-nextjs-rewrite-backend-in-place.md` | Mentions the `jknm-convex` prototype and Supabase as the destination; Next-lock-in assumption changes with vinext (still Next API, different runtime). |
| `docs/adr/0004-self-hosting-hetzner-kamal.md` | Superseded by Cloudflare Workers; mark Status: superseded by this migration's ADR. Its "Cloudflare in front of the VPS" and "Postgres on VPS" lines no longer apply. |
| `docs/adr/0005-stay-on-unstable-cache.md` | "On Vercel..." reasoning (Data Cache, Runtime Cache) is moot; verdict stands for new reasons (vinext `cacheComponents` incomplete; persistence via KV/Response Store). The "what would change the answer: Hetzner" trigger is dead. |
| `docs/adr/0006-no-isr-on-article-pages.md` | Same trigger section; add Workers Cache/`Cloudflare-CDN-Cache-Control` as a possible alternative route to edge caching. Facts about Next 16 PPR remain. |
| `docs/adr/0008-b2-buckets-fronted-by-cloudflare-custom-domains.md` | Fully superseded: B2 + CNAME + rewrite rule -> R2 custom domain; `NEXT_PUBLIC_AWS_MEDIA_BUCKET_NAME` removed. |
| `docs/adr/0010-domains-modeled-by-role.md` | "Vercel-owned" `DEPLOYMENT_ORIGIN`/`jknm-si.vercel.app` references; owner becomes Cloudflare (Workers custom domain). |
| `docs/adr/0002-orpc-not-server-actions.md` | Stays valid; footnote that Server Actions now execute under vinext (verify). |
| `docs/architecture.md` | Stack line (Vercel, B2, Supabase direct), Next 16.2.10 (now 16.3.2), better-auth pinned 1.6.27 (now 1.7.1), "hosted on Vercel", Caching section (Data Cache assumption), Domains table (`Vercel` ownership, `MEDIA_CDN_ORIGIN` behind B2), `wake_supabase` description, `portless`. |
| `docs/domain-cutover-checklist.md` | Entirely Vercel-oriented (done 2026-08-31); needs a sibling Cloudflare cutover runbook (7.2 step 9-12) and a note that the `jknm.si` DNS owner sits outside Cloudflare. |
| `docs/cache-invalidation.md` | Accurate API-wise; add the adapter/propagation caveat from 2.3; "Next's local documentation" paths point at `node_modules/next/dist/docs` (still present only while `next` is installed alongside vinext). |
| `docs/research/nextjs16-caching-verdict.md` | Vercel Data Cache/Runtime Cache sections are platform-specific; conclusions remain a historical record; add a banner. |
| `docs/research/codebase-health-audit-2026-07-23.md`, `legacy-migration-notes.md`, `legacy-id-redirects-and-seo-metadata.md` | Reference Vercel/Supabase/sharp/B2 in context; mostly historical, add banners rather than edits. |
| `docs/research/algolia-vs-orama-search.md` | Parked, but its Vercel assumptions change. |
| `AGENTS.md` / `CLAUDE.md` | The Next.js agent-rules block says to read `node_modules/next/dist/docs`; on vinext, docs for behavior come from `VX/docs` and `check.ts`. Vendored `vendor/*` submodules are empty on this checkout (`git submodule update --init`). The block is re-written by `next dev`; vinext does not run it. |
| `README.md`, `TODO.md`, `vercel.json`, `next.config.ts` | `vercel.json` obsolete; `TODO.md` custom-thumbnail-crop and "image-pipeline rewrite" items are folded into 4.6. |

---

## 9. Recommendations and open questions

### Recommendations (where this deviates from plan.md)
1. **Proceed with vinext on Workers Paid**; treat it as beta: pin `vinext`, `@vinext/cloudflare`, Vite, keep `next build` working on the branch until cutover.
2. **Start the `jknm.si` -> Cloudflare DNS delegation conversation now** (7.1).
3. **Images**: originals only to R2; read-time transforms with Cloudflare Images on the media zone; browser-side crop; no sharp, no Vercel service, no Containers (kept as documented fallback). Do not implement write-time variants.
4. **Hyperdrive**: `pg`/Drizzle node-postgres or postgres.js with prepare enabled; `--caching-disabled`; verify Supabase IPv6 vs session pooler first.
5. **Cache adapter**: Response Store (self-contained) for `unstable_cache`/`updateTag` correctness; stay on `unstable_cache`.
6. **Replace `googleapis`**, `dns.lookup`, B2/AWS SDKs before the first Workers deploy of the full app.
7. Treat the `cf` CLI as beta: the vinext template already uses it, but keep `--legacy-wrangler-cloudflare-init` in mind as an escape hatch.
8. Profile where Vercel's 4 CPU-hours went (Vercel Observability) before sizing Workers; likely not the 36k bots.
9. Add a Cloudflare cutover ADR that supersedes ADR-0004 and ADR-0008; fix `CONTEXT.md` `jknm-convex` section.

### Open questions (need a spike or the maintainer)
- Does Hyperdrive reach Supabase's IPv6-only direct host on the Free plan, or must the session pooler be used? (not stated in `CFD/hyperdrive`.)
- Who controls `jknm.si` registrar/DNS and can change NS to Cloudflare? Mail records (Resend skipped in the cutover checklist) must move with it.
- Does `@orpc/next` `.actionable()` + `unwrap_server_function` work unchanged on vinext's Server Action implementation? Does a `"use server"` route module (`api/media/route.ts`) behave?
- Can `Cloudflare-CDN-Cache-Control` make `/novica/*` cacheable for anonymous traffic in vinext without leaking admin-only archived content?
- Real number of media objects and `jknm-legacy` bucket size (drives Images unique-transformation cost and Super Slurper duration).
- Is `JKNM_SERVICE_ACCOUNT_CREDENTIALS` under the 5 KB variable limit?
- Does the Images AVIF dimension limit (1,200 px listed) affect AVIF *output* of large originals, or only AVIF *inputs*? (`CFD/images/get-started/limits.mdx` is ambiguous.) Prefer `format=auto` and check actual outputs.
- Does `vp create` accept the vinext template directly, or is `vpx create-vinext-app` the path? (`VP/` has no vinext template; only ecosystem-ci references.)

## Addendum (2026-10-26): `jknm.si` DNS is owned by t-media

**Constraint.** `jknm.si` and its registrar belong to t-media (the 2008 site's authors), who also host Google Workspace, a Sites page and email on it. Moving the whole zone to Cloudflare is unlikely. Workers custom domains need the zone on Cloudflare; the zone-less alternatives are plan-gated (CNAME/partial setup: Business/Enterprise, `cloudflare-docs/src/content/docs/dns/zone-setups/partial-setup/index.mdx:17`; subdomain setup is also plan-gated, tier not read).

**Chosen direction: Cloudflare for SaaS with `jknm.org` as the SaaS zone.** Source: `cloudflare-docs/src/content/docs/cloudflare-for-platforms/cloudflare-for-saas/start/advanced-settings/worker-as-origin.mdx`.
- In the `jknm.org` zone: fallback origin with an originless record (`service.jknm.org AAAA 100::`) and a Workers route `*/*` to the app.
- Register `www.jknm.si` as a custom hostname; t-media adds one record: `www.jknm.si CNAME service.jknm.org`. Cloudflare issues the certificate (validation method to confirm). Their Workspace, Sites and email records stay untouched.
- **Apex (`jknm.si`) is the open point.** A CNAME is impossible at the apex, and pointing an A record at a SaaS target needs apex proxying, an account-team feature (`getting-started.mdx:106`). Plan: t-media points the apex A record at a redirector that 308s to `https://www.jknm.si` (the Vercel project kept alive for redirect-only costs no function CPU, or another static redirector).
- **To verify before cutover:** custom hostname quota/price on the current plan, certificate validation method and renewal with a CNAME-only customer, and Workers route behavior when both `jknm.org` and custom hostnames hit the same Worker (the app's host allowlist must include `www.jknm.si`).

**Spike order.** (1) Throwaway subdomain of `jknm.org` as custom hostname, proving Worker, certificate and host allowlist. (2) Ask t-media for the `www` CNAME and the apex redirect target at cutover. Owner is reachable and has agreed it can be arranged.
