# TODO

## later

- submit sitemap to bing webmaster and indexnow. AIs use bing.
- check whether `card.tsx`'s `is_legacy_hit` branch (old S3 `thumbnail.png` path convention for legacy Algolia hits) is still needed — thumbnails were migrated at some point, this branch might be dead like the permalink one was
- add a unit test for `EditorProvider`'s readiness state machine (`components/editor/editor-context.tsx`, `"initializing" | "ready"` transitions) — deferred when narrowing `EditorContext`'s interface because there's no existing EditorJS-mounting test harness to build on; a separate investment from the interface narrowing itself
- `src/components` architecture pass: `DraftArticleContext` has the same dead-guard shape `EditorContext` just had — every consumer (`image-selector.tsx`, `toolbar-buttons.tsx`, `upload-dialog.tsx`) repeats `if (!draft_article) return null` against a case that can't occur given `editor.tsx`'s fixed provider order; give it the same `useDraftArticleContext()`-throws-instead-of-null treatment
