Yes — several conflict. Here's the verdict for your ESLint stack (ESLint v10 released Feb 2026):

**Verdict: don't upgrade yet — `eslint-plugin-import` and `eslint-plugin-react` (direct + pulled in by `eslint-config-next`) both conflict.**

| Package | vs ESLint v10 |
|---|---|
| `eslint-plugin-import` ^2.32.0 | ❌ Peer dep caps at `^9`. Maintainers say "not compatible, upgrading is incorrect." Replace with `eslint-plugin-import-x` (v4.16.2+ supports v10). |
| `eslint-plugin-react` ^7.37.5 | ❌ Peer caps at `^9.7` **and** runtime crash on v10: `TypeError: contextOrFilename.getFilename is not a function` (removed API). v10 support still unreleased (jsx-eslint#4022). |
| `eslint-config-next` 16.3.0 | ⚠️ Peer is `>=9.0.0` so it *accepts* v10, but it still bundles `eslint-plugin-import@^2.32.0` + `eslint-plugin-react@^7.37.0` (confirmed from registry:16.3.0 deps) — the v10 fix (next#91710, switched to import-x) hasn't shipped in 16.3.0. |
| `eslint-plugin-drizzle` ^0.2.3 | ⚠️ No v10 (or even clean v9) support — needs `fixupPluginRules()` from `@eslint/compat`; 1.0.0-rc in progress. |
| `@typescript-eslint/*` ^8.67.0 | ✅ v10 supported since 8.56.0 |
| `typescript-eslint` ^8.67.0 | ✅ |
| `eslint-plugin-react-hooks` 7.1.1 | ✅ Peer includes `^10.0.0` (Apr 2026 release) |
| `@eslint/compat` ^2.1.0 | ✅ Intended bridge for v10 |
| `@types/eslint` ^9.6.1 | ⚠️ v9 types; ESLint v10 ships its own — harmless but stale |

Path forward when you're ready: drop `eslint-plugin-import` → `eslint-plugin-import-x`, wait for `eslint-plugin-react` v10 release (or use `@eslint/compat` fixup + pinned React `version` setting), and bump `eslint-config-next` once it ships the import-x switch. Also requires Node ≥20.19 and a flat `eslint.config.*` (already on flat config? your `lint` script is `eslint .`, so yes).

---

