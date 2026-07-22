# TODO

- #22 migration: before backfilling legacy `published_article.url` values into `article_slugs`, check for existing new-table slugs that already match a legacy `url` (now prevented going forward by `generate_unique_article_slug` checking `published_article.url`, but any new-table article published *before* that check landed could already hold a slug matching a legacy url). If found, the legacy article's url must NOT be force-suffixed — decide precedence explicitly (legacy url wins, since it's an existing public link) rather than letting #9's collision-suffixing logic silently rewrite it.
- submit sitemap to bing webmaster and indexnow. AIs use that.
- >[browser] Detected `scroll-behavior: smooth` on the `<html>` element. To disable smooth scrolling during route transitions, add `data-scroll-behavior="smooth"` to your <html> element. Learn more: https://nextjs.org/docs/messages/missing-data-scroll-behavior
- improve mobile
- osnutka dva reš še slike in objav
- statične bold zgodovina **
- homepage article summary is bold and different font
- https://gemini.google.com/app/fe2c72a3af40444e (seo for domain switch)
- galerija mogoče tekst ne centrirat ampak levo

## Planned, sequenced (see docs/adr/0002)

1. ~~`content_markdown`~~ — dropped 2026-07-22 (`drizzle/0007_sturdy_darwin.sql`).
   `content_preview` is already generated live from `content_json` via
   `convert_content_to_text` (see `~/lib/algoliasearch.ts`), so the column
   had no consumer. Revisit only if a real need for stored (vs. derived)
   markdown shows up.
2. ~~**better-auth** migration~~ (#6, #32) — done; `next-auth` is gone from
   `package.json` and `src/server/auth/*` is fully on `better-auth`.
3. **Caching + structure + oRPC rewrite** — remove `unstable_cache` and
   `revive-cache-dates`, collapse the dual `invalidateQueries`/`revalidateTag`
   invalidation into one helper, restructure `src/server`, land oRPC. One
   restructuring, not three.
4. ~~Drop legacy tables~~ — done 2026-07-22 (`drizzle/0006_clammy_echo.sql`), verified against
   all 693 rows with `scripts/verify-legacy-migration.ts` before dropping.
5. ~~Fossil sweep~~ — done 2026-07-22: renamed `infinite-no-trpc.tsx` to
   `infinite-articles.tsx`, deleted the dead `DuplicateUrlWarning` (commented
   tRPC query) in `uredi/[draft_id]/editor.tsx`, dropped unused
   `@tanstack/react-query-persist-client` and `@tanstack/query-sync-storage-persister`.