# TODO

- `articles.content_markdown` must be regenerated on every save (feeds Algolia + excerpt generation, per #13) — not yet wired into #19/#20's save path.
- #22 migration: before backfilling legacy `published_article.url` values into `article_slugs`, check for existing new-table slugs that already match a legacy `url` (now prevented going forward by `generate_unique_article_slug` checking `published_article.url`, but any new-table article published *before* that check landed could already hold a slug matching a legacy url). If found, the legacy article's url must NOT be force-suffixed — decide precedence explicitly (legacy url wins, since it's an existing public link) rather than letting #9's collision-suffixing logic silently rewrite it.
