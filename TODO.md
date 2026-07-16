# TODO

- `articles.content_markdown` must be regenerated on every save (feeds Algolia + excerpt generation, per #13) — not yet wired into #19/#20's save path.
- #22 migration: before backfilling legacy `published_article.url` values into `article_slugs`, check for existing new-table slugs that already match a legacy `url` (now prevented going forward by `generate_unique_article_slug` checking `published_article.url`, but any new-table article published *before* that check landed could already hold a slug matching a legacy url). If found, the legacy article's url must NOT be force-suffixed — decide precedence explicitly (legacy url wins, since it's an existing public link) rather than letting #9's collision-suffixing logic silently rewrite it.
- submit sitemap to bing webmaster and indexnow. AIs use that.
- run `bun run scripts/fix-thumbnail-media-extensions.ts` after the migration is done.

## issues

⨯ ReferenceError: Element is not defined
    at module evaluation (src\components\editor\editor-context.tsx:3:1)
    at module evaluation (src\app\uredi\[draft_id]\editor.tsx:13:1)
  1 | "use client";
  2 |
> 3 | import EditorJS from "@editorjs/editorjs";
    | ^
  4 | // @ts-expect-error no types
  5 | import DragDrop from "editorjs-drag-drop";
  6 | // @ts-expect-error no types {
  digest: '2609235270'
}