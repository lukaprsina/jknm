# Handoff: dehotlinking `www.jknm.si` links in article content

## State as of 2026-08-17

The old site (`www.jknm.si`) is still live but `robots.txt`-disallowed — links to it aren't 404s, they're just pointing at a site we don't want to keep serving traffic to/from.

`scripts/retired/links/dehotlink-article-links.ts` (audited via `scripts/retired/links/audit-article-hotlinks.ts`) was the tool for this: it rewrites `/si/?id=<legacy_id>` links to the migrated `/novica/<slug>` and self-hosts `/media/*.pdf` links to `vsebina.jknm.org`. It ran `--execute` twice: 2026-07-28 (commit `dd45fd7`, 13 article-id links + 6 PDFs across 10 articles) and again 2026-08-17 to fix a regression on the `/zgodovina` content page (recreated 2026-08-15, re-pasting old HTML reintroduced ~30 `/si/?id=` links + 1 PDF across 6 rows).

Post-fix audit (`bun run scripts/retired/links/audit-article-hotlinks.ts`, 2026-08-17): `article-link` and `media-file` refs are both at **0**. Remaining `jknm.si` refs are exactly the two categories out-of-scope by design: 30 `other` (bare-host text mentions, not links) and 181 `static-page-link` (old pages never migrated).

## Next steps

1. ~~Run `bun run scripts/retired/links/dehotlink-article-links.ts --execute` to fix the Zgodovina regression.~~ Done 2026-08-17.
2. ~~Re-run `bun run scripts/retired/links/audit-article-hotlinks.ts` after, to confirm `article-link`/`media-file` drop to ~0.~~ Confirmed: both at 0.
3. Watch for this recurring — if `/zgodovina` (or any other page) gets hand-edited from old source again, the stale links come back. Might be worth a lint/CI check that fails on new `jknm.si` refs in `content_json`, rather than relying on someone remembering to re-run the script.
4. Remaining `static-page-link` refs (`kras01`–`kras04`, `izobraževanje/kodeks`, `izobraževanje/program`, `klub/interes`, `etc/impresum`) point at old-site pages that were never migrated — out of scope for the script by design. Tracked in `LINKS.md`.
5. `audit-all-discrepancies.ts` also currently reports 85 `title_mismatch` and 16 `orphaned_slug` — unrelated to links, not investigated as part of this handoff.

See `LINKS.md` for the older, more detailed per-article breakdown (title renames, unrecoverable media, static-page-link inventory) this work built on.
