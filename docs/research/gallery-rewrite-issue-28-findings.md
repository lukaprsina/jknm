# Gallery/Lightbox Rewrite (Issue #28) — Additional Findings

> **Status (2026-07-23): historical.** Issue #28 is closed and resolved (commit `9532e36`,
> "Rewrite image gallery: fix scroll-lock, landscape crop, caption alignment, #28"). Kept as a
> record of the pre-rewrite findings; do not treat any finding below as still-open without
> re-checking `gallery-store.tsx`/`image-gallery.tsx` first.

Primary-source code research against the current `tweaks` branch, supplementing
the 11 issues already documented in GitHub issue #28. Only NEW findings are
listed below; each cites file:line.

## Files read in full
- `src/components/gallery-store.tsx`
- `src/app/novica/[published_url]/image-gallery.tsx`
- `src/components/image-with-caption.tsx`
- `src/components/editor/editor-to-react.tsx`
- `src/lib/editor-utils.ts` (source of `EditorJSImageData`)
- `src/components/ui/carousel.tsx`
- `src/hooks/use-breakpoint.ts`
- `src/app/novica/[published_url]/page.tsx`, `src/app/(static)/layout.tsx`
- `vitest.config.ts`
- `docs/bugs/stale-draft-state-on-new-draft.md` (precedent for singleton-store bugs)

## New findings

### 1. `gallery_store.set("images", ...)` is called mid-render, inside `useMemo`, not an effect
`src/components/editor/editor-to-react.tsx:59-82` (specifically line 75) computes
`editor_data` inside a `useMemo` callback and, as a side effect of that
computation, calls `gallery_store.set("images", image_data)` and
`setHeading(title)` (line 70) directly during render. Mutating an external
store (and calling `setState`) from inside `useMemo` is a React anti-pattern —
it isn't guarded against double-invocation (React 19 Strict Mode / future
concurrent re-renders can call the memo factory more than once), and unlike
`image-with-caption.tsx`'s registration (which happens in a `useEffect`,
`image-with-caption.tsx:55-58`), this write happens before commit. The two
registration call sites for the same store therefore differ not only in
write protocol (blind-replace vs dedup-add, already known issue #4) but also
in *when* they run relative to React's render/commit lifecycle.

### 2. Zustand-x is not an isolated legacy pattern — it's used in 11 files across the app
`grep "zustand-x"` matches: `src/components/gallery-store.tsx`,
`src/components/editor/editor-store.ts`, `src/components/static/toc-scroll.tsx`,
`src/components/shell/mobile-header.tsx`, `src/components/shell/desktop-header.tsx`,
`src/app/uredi/[draft_id]/toolbar.tsx`, `src/app/uredi/[draft_id]/image-selector.tsx`,
`src/app/preveri/preveri-client.tsx`, plus `package.json` and
`docs/bugs/stale-draft-state-on-new-draft.md`. Plain `zustand` (`^5.0.14`) is
already a direct dependency (`package.json:157`) alongside `zustand-x`
(`package.json` — see `zustand-x` line), so the tooling for a full migration
already exists, but issue #28's gallery-store rewrite would be one isolated
instance, not part of a larger sweep — worth flagging so reviewers don't
assume this sets the final target API for the rest of the app.

### 3. There is precedent in this codebase for the exact "module-singleton store leaks across navigations" bug class
`docs/bugs/stale-draft-state-on-new-draft.md` documents `editor_store`
(built the same way as `gallery_store`, via `zustand-x`'s `createStore` at
module scope) leaking stale state across route navigations because nothing
resets it on remount. This is the same root cause as known issue #5
(images never cleared between article navigations) — it has already bitten
this codebase once, with a written root-cause analysis and fix plan the
gallery rewrite could reuse (reset-on-mount / scope-store-per-instance
pattern), rather than re-deriving a fix from scratch.

### 4. Zero test files exist anywhere in the first-party codebase, and `vitest.config.ts` has no DOM environment configured
`vitest.config.ts:1-10` sets `environment: "node"` with no `jsdom`/`happy-dom`.
A repo-wide glob for `*.test.{ts,tsx}` / `*.spec.{ts,tsx}` returns matches only
under `node_modules` and `vendor/` — none in `src/`. This means component/hook
tests for the new `gallery-store`/`MyCarousel` (e.g. testing `useGalleryImages`,
`useOpenImage`, keyboard handling) cannot run under the current Vitest config
without first adding a DOM environment and test-library dependencies; this is
infrastructure work the rewrite will need to account for, not just app code.

### 5. `Carousel`'s own keyboard handler duplicates `MyCarousel`'s arrow-key handling
`src/components/ui/carousel.tsx:86-97` wires `onKeyDownCapture` on the
`Carousel` root div to call `scrollPrev()`/`scrollNext()` on ArrowLeft/ArrowRight.
Separately, `image-gallery.tsx:130-135` installs a `window`-level `keydown`
listener that also calls `emblaApi.scrollPrev()`/`scrollNext()` on the same
keys. These are two independent listeners (one capture-phase on the carousel
DOM node, one bubble-phase on `window`) that can both fire for a single
keypress depending on focus, silently double-processing (or racing) arrow-key
navigation. This is a distinct bug from known issue #6 ("MyCarousel doing too
much") — it's cross-component duplication, not just single-component bloat.

### 6. No focus trap / no dialog semantics on the lightbox
The portal root (`image-gallery.tsx:46-51`) is a plain `<div>` with no
`role="dialog"`, no `aria-modal="true"`, and no `aria-label`. Focus is never
programmatically moved into the lightbox when it opens, nor restored to the
triggering thumbnail when it closes. This goes beyond the documented
"no scroll-lock" issue — keyboard/screen-reader users can tab out of the
lightbox into the page behind it while it's still visually open.

### 7. `CloseButton` is icon-only with no accessible name
`image-gallery.tsx:193-206` renders a `<Button>` containing only `<XIcon />`,
no `aria-label` and no `sr-only` text — contrast with `CarouselPrevious`/
`CarouselNext` in `src/components/ui/carousel.tsx:216-217` and `245-246`,
which both include `<span className="sr-only">Previous/Next slide</span>`.
Screen readers announce the close button as unlabeled.

### 8. `alt` text has no fallback when caption is empty
`image-gallery.tsx:240` sets `alt={image.caption}` directly. If `caption` is
`""` (a valid `EditorJSImageData.caption` value per
`src/lib/editor-utils.ts:31`), the lightbox image gets `alt=""`, which screen
readers treat as decorative — indistinguishable from an intentionally
decorative image, even though this is user-facing article content.

### 9. `image-with-caption.tsx` computes the same derived values twice (once in an effect, once in render)
`src/components/image-with-caption.tsx:41-52` (inside `useEffect`) and
`:60-64` (in the render body) both independently call
`image_sizes.find((size) => size.path === src)`, both re-derive `new_src`,
and both throw an equivalent "not found" error — once to build `imageData`
state for the gallery store, once for the directly-rendered `<Image>`. This
duplicated lookup/throw logic is redundant and a maintenance hazard (the two
copies could drift).

### 10. Inline article images can render at 2x the size the lightbox opens them to
`editor-to-react.tsx:150,160-166` (`DOUBLE_IMAGES` flag, hardcoded `true`)
doubles the rendered width/height for small (`<500×500`) images in the
inline article view. `GalleryImage` in `image-gallery.tsx:216-222`, however,
computes its sizing straight from `image.file.width`/`height` with no
doubling. For small images this means the thumbnail in the article body is
2x the pixel dimensions of what opens in the lightbox — a visible size
mismatch/downgrade on click, not just the already-known cropping/caption
issues.

### 11. `ImageGallery` is mounted from two different route trees, both reading the same singleton store
`src/app/novica/[published_url]/page.tsx:75` and
`src/app/(static)/layout.tsx:17` both render `<ImageGallery />` (the latter
importing it cross-route-group from `../novica/[published_url]/image-gallery`,
confirmed via `src/app/(static)/layout.tsx:7`). Directory listing confirms
`(static)` and `novica` are sibling top-level route groups, so today they
never mount simultaneously for one request — but the import path itself is a
code-smell (a route-group layout reaching into a sibling route's private
folder for a component), and if the routing structure changes this is latent
double-mount risk (duplicate global `window` keydown/wheel/mousedown
listeners per known issue #6's ref-tracking, times two).

## Not re-reported (already in issue #28's list of 11)
Scroll-lock, mobile landscape cropping, caption centering, zustand-x
get/set leakage + dedup-vs-replace inconsistency, images-never-cleared,
MyCarousel doing too much, unbounded ref array, broken "Space" check, legacy
"Esc"/"Return" key names, useCallback-returning-createPortal indirection,
redundant `default_image` subscription in `MyCarousel`.
