# TODO

## later

- submit sitemap to bing webmaster and indexnow. AIs use bing.
- check whether `card.tsx`'s `is_legacy_hit` branch (old S3 `thumbnail.png` path convention for legacy Algolia hits) is still needed — thumbnails were migrated at some point, this branch might be dead like the permalink one was
- add a unit test for `EditorProvider`'s readiness state machine (`components/editor/editor-context.tsx`, `"initializing" | "ready"` transitions) — deferred when narrowing `EditorContext`'s interface because there's no existing EditorJS-mounting test harness to build on; a separate investment from the interface narrowing itself
- `src/components` architecture pass: `DraftArticleContext` has the same dead-guard shape `EditorContext` just had — every consumer (`image-selector.tsx`, `toolbar-buttons.tsx`, `upload-dialog.tsx`) repeats `if (!draft_article) return null` against a case that can't occur given `editor.tsx`'s fixed provider order; give it the same `useDraftArticleContext()`-throws-instead-of-null treatment
- custom-thumbnail cropping is a no-op end to end, discovered while reviewing `api/media/route.ts`: the only caller that sends a `crop` (`thumbnail-selection-store.ts`'s `uploadCustomThumbnail` → `upload_image_by_file`) hits the direct-file branch, which ignores `crop_entry` entirely; the branch that does honor `crop_entry` only fires for `upload_image_by_url`, which no caller ever passes a crop to. The stored `thumbnail_x/y/width/height` columns only round-trip back into the editor's crop UI (`new-adapter.ts`'s `reconstruct_thumbnail_crop`) — nothing renders a cropped image anywhere (cards/OG use `thumbnail_media.original` uncropped). Not urgent; folding into the planned image-pipeline rewrite rather than patching in place.
