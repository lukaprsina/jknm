# TODO

- `articles.content_markdown` must be regenerated on every save (feeds Algolia + excerpt generation, per #13) — not yet wired into #19/#20's save path.
- #22 migration: before backfilling legacy `published_article.url` values into `article_slugs`, check for existing new-table slugs that already match a legacy `url` (now prevented going forward by `generate_unique_article_slug` checking `published_article.url`, but any new-table article published *before* that check landed could already hold a slug matching a legacy url). If found, the legacy article's url must NOT be force-suffixed — decide precedence explicitly (legacy url wins, since it's an existing public link) rather than letting #9's collision-suffixing logic silently rewrite it.
- submit sitemap to bing webmaster and indexnow. AIs use that.
- >[browser] Detected `scroll-behavior: smooth` on the `<html>` element. To disable smooth scrolling during route transitions, add `data-scroll-behavior="smooth"` to your <html> element. Learn more: https://nextjs.org/docs/messages/missing-data-scroll-behavior
- improve mobile
- osnutka dva reš
- statične bold zgodovina **
- before dropping the legacy tables: write a script verifying every migrated article is
  equivalent where it matters (title, slug, authors, content, thumbnail, media links) between
  `published_article`/`draft_article` and `articles`.
- homepage article summary is bold and different font

## Planned, sequenced (see docs/adr/0002)

1. `content_markdown` save-path wiring (above) — correctness, independent.
2. **better-auth** migration (#6) — shallow seam, must precede 3.
3. **Caching + structure + oRPC rewrite** — remove `unstable_cache` and
   `revive-cache-dates`, collapse the dual `invalidateQueries`/`revalidateTag`
   invalidation into one helper, restructure `src/server`, land oRPC. One
   restructuring, not three.
4. Drop legacy tables — gated on moving `find_available_slug` off
   `published_article.url` and on the equivalence script above.
5. Fossil sweep — rename `infinite-no-trpc.tsx`, delete the commented tRPC query in
   `uredi/[draft_id]/editor.tsx`, drop unused `react-query-persist` deps.