# Next.js 16 Upgrade Plan

## Current state

`package.json` already pins `next@16.2.10` (and the installed `node_modules/next` is
`16.2.10` too), with `react@19.2.7` / `react-dom@19.2.7` and `eslint-config-next@16.2.10`.
So the dependency bump to v16 is **already done** — this is not a 13 → 16 migration from
scratch. A pass through the codebase for each version's breaking changes shows most of the
required code migration already happened along the way:

- `src/proxy.ts` exists (the v16 `middleware` → `proxy` rename) — no `middleware.ts` left.
- Dynamic route `params` are already `Promise<...>` and `await`ed (checked
  `src/app/novica/[published_url]/page.tsx`, `src/app/uredi/[draft_id]/page.tsx`,
  `src/app/api/auth/[...nextauth]`).
- `revalidateTag(...)` calls already use the required two-argument form
  (`revalidateTag("drafts", "max")` etc. in `src/server/article/*`, `src/server/author/*`).
- No `next/legacy/image`, no `images.domains`, no `unstable_cacheTag` / `unstable_cacheLife`
  / `unstable_rootParams`, no `experimental_ppr`, no parallel-route (`@slot`) folders, no
  sync `cookies()/headers()/draftMode()` property access found.
- No custom Webpack config in `next.config.mjs`, so `next build`'s new
  "Turbopack by default, fail on unexpected webpack config" check won't trip.

So the remaining work is narrower than a full migration. Below is what's actually
outstanding, in priority order.

## 1. ~~`next lint` is removed in v16~~ — fixed

`package.json` had `"lint": "next lint"`, which was **removed** in Next.js 16. Fixed:

- Replaced `.eslintrc.cjs` with a flat `eslint.config.mjs`, built directly from
  `eslint-config-next/core-web-vitals` + `typescript-eslint`'s `recommendedTypeChecked` /
  `stylisticTypeChecked` configs (no `FlatCompat` needed — `eslint-config-next@16` ships
  flat-config arrays natively). All the custom rules from the old `.eslintrc.cjs`
  (`drizzle/enforce-*-with-where`, the `@typescript-eslint/*` overrides) were carried over.
- Updated the script to `"lint": "eslint ."`.
- The codemod (`bunx @next/codemod@canary next-lint-to-eslint-cli .`) crashes in this
  environment (`Cannot find module '.bin/jscodeshift'`, a bun/npm bin-resolution issue), so
  this was done by hand instead.
- **Also downgraded `eslint` from `^10.6.0` to `^9.39.1`.** ESLint 10 removed
  `context.getFilename()`, which `eslint-plugin-react@7.37.5` (the current latest release)
  still calls internally — every file crashed the linter (`TypeError: ...
  contextOrFilename.getFilename is not a function`). `eslint-config-next` only requires
  `eslint >= 9.0.0`, and flat config works fine on 9.x, so this restores compatibility
  without losing anything Next 16 needs. Revisit the ESLint 10 bump once
  `eslint-plugin-react` ships a fix upstream.
- Added `vendor/**` and `drizzle/**` to the flat config's `ignores`. `next lint` used to
  only lint Next's default directories (`app`, `pages`, `components`, `lib`, `src`), so the
  vendored `zod` fork under `vendor/` and the generated `drizzle/relations.ts` /
  `drizzle/schema.ts` were never linted before. Plain `eslint .` lints from cwd, so without
  this it flagged ~22,700 problems in code that was never meant to be linted. With the
  ignores in place, `bun run lint` reports 30 problems — all genuine pre-existing findings
  in `src/` (mostly newer `react-hooks` rules like `set-state-in-effect`,
  `preserve-manual-memoization`, `purity`, plus a few `@typescript-eslint` style rules).
  Left those alone — that's the "bad code, deal with later" bucket, not part of this
  upgrade.

## 2. Verify the deploy/runtime environment meets v16's new minimums

- **Node.js 20.9+** required (18 is no longer supported). Confirm this on Vercel's project
  settings / any Docker base image — not visible from the repo alone.
- **TypeScript 5.1+** required — already satisfied (`typescript: ^6.0.3`).
- Browsers: Chrome/Edge 111+, Firefox 111+, Safari 16.4+ (only matters if you support older
  browsers deliberately).

## 3. Low-priority cleanup

- ~~`"dev": "next dev --turbopack"`~~ — fixed. The `--turbopack` flag was redundant now
  that Turbopack is the default in both `next dev` and `next build`; simplified to
  `"next dev"`.
- `next.config.mjs` has a commented-out `// reactCompiler: false,`. The React Compiler is
  now stable (promoted out of `experimental`) and `babel-plugin-react-compiler` is already
  a dependency. Turning it on (`reactCompiler: true` at the top level, not under
  `experimental`) is an opt-in perf improvement, not a requirement — expect slower
  build/dev compile times if enabled.
- `next.config.mjs` sets `images.loader: "custom"` with `images.unoptimized: true`, so
  Next's built-in image optimizer is bypassed entirely. This means the v16 changes to
  image defaults (`minimumCacheTTL` 60s → 4h, `imageSizes` losing `16`, `qualities`
  defaulting to `[75]`, `maximumRedirects` capped at 3, local-IP restrictions) **do not
  apply** to this project — nothing to do here, just confirmed it's a non-issue.
- `experimental.serverActions.bodySizeLimit` and `experimental.mdxRs` in
  `next.config.mjs` are still valid experimental keys in 16.2.10 — no rename needed.

## 4. Run the upgrade codemod as a safety net

Since the version bump already happened outside of the codemod tool, it's worth running
the codemod once anyway to catch anything the manual grep-based review above missed
(it's idempotent — a no-op on anything already migrated):

```bash
bunx @next/codemod@canary upgrade latest
```

This also offers to run `remove-unstable-prefix` and `middleware-to-proxy` if there's
anything left, and can re-run the React 19 codemods.

## 5. After upgrading: sanity checks

- `bun run build` — confirm it completes (this will also surface the `next lint` removal
  if the build pipeline still calls `bun run lint` as a pre/post step anywhere, e.g. CI).
- `bun run dev` and click through the app — Turbopack is now the default dev/build engine;
  watch for any Sass `~` imports or `resolve.fallback`-style Webpack workarounds that
  don't have a Turbopack equivalent (none found in this repo, but worth a visual pass).
- Check any CI config (GitHub Actions, Vercel build command overrides) for hardcoded
  `next lint` invocations outside `package.json`.

---

This intentionally does not touch the "lots of bad code and modules" cleanup — scope here
is strictly what Next.js 16 requires to keep building and running correctly.
