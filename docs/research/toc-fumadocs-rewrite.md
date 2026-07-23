# Research: table-of-contents rewrite (issue #30)

> **Status (2026-07-23): historical.** Issue #30 is closed ("Verified in code: complete TOC
> rewrite implemented"). This is pre-implementation research, kept for the API citations against
> `vendor/fumadocs`; it does not describe the shipped TOC feature's actual shape.

Investigation only, no source changes. Citations are repo-relative paths.
Initial pass read against an isolated worktree defaulted to `main`
(commit `6caf989`, 2026-07-20); follow-up verification pass (section 0 note
below) ran directly against the real `tweaks` branch checkout.

## 0. Correction: `vendor/fumadocs` and `node_modules` verified for real

The initial research pass ran in an isolated git worktree that defaulted to
the `main` branch, which does not have the `vendor/fumadocs` submodule
checked out or `node_modules` installed -- so it sourced fumadocs' API from
GitHub's `main` branch (untethered from any pinned commit) and
`@stefanprobst/rehype-extract-toc`'s API from its README. That was a
worktree/branch artifact, not a real repo gap: on `tweaks`, `.gitmodules`
correctly declares `vendor/fumadocs` (`url =
https://github.com/fuma-nama/fumadocs`), and `vendor/fumadocs` is a real,
correctly checked-out submodule pinned at commit
`1a50aa38a05a7399d26d8a10d74c6909111735ef` (`fumadocs-core@16.11.5`,
committed 2026-07-20 01:06:34 +0800).

A follow-up pass re-ran directly against the real `tweaks` checkout, with
both the submodule and `node_modules` present, and read the actual pinned
`vendor/fumadocs/packages/core/src/toc.tsx` and the actual shipped
`node_modules/@stefanprobst/rehype-extract-toc` type declarations directly.
**Result: every substantive API claim in sections 2 and 3 below, originally
sourced from GitHub `main` and the package README, matched the real pinned
source exactly** -- see the two "Verified against real local source" notes
in those sections for the one minor addition found (an `autoScroll` prop)
and the exact citations now available.

## 1. Ticket verification: Implementation Decisions

| Ticket claim | Verified? | Detail |
|---|---|---|
| Shared shape `TocEntry { id, title, depth }[]` | Not yet implemented | No `TocEntry` type exists anywhere in `src/` today (`grep -r TocEntry src` -> no hits). This is greenfield. |
| Port `AnchorProvider`/`TOCItem`/`Observer` from `vendor/fumadocs`'s `packages/core/src/toc.tsx`, "markdown-agnostic ... nothing MDX-specific" | Confirmed, sourced from upstream GitHub (see section 2) since the submodule does not exist locally. The file has zero MDX/remark coupling -- it only consumes `TOCItemType[]` (`{ title, url, depth }`) and calls `document.getElementById`. |
| "Do not import `getTableOfContents` from fumadocs" | N/A -- not present in `toc.tsx` at all; it lives in `fumadocs-core/src/mdx-plugins` (remark-specific), a different file. Confirms the ticket's exclusion is correct and trivial to honor since it is not even in the file being ported. |
| Static producer: finish wiring `rehype-slug` + `@stefanprobst/rehype-extract-toc` (+`/mdx` export) in `next.config.js` | The file is `next.config.mjs`, not `.js` (the ticket's filename does not exist; see `next.config.mjs`). Commented-out imports and `rehypePlugins`/`remarkPlugins` array match the ticket's description exactly: `next.config.mjs:9-13` (imports), `next.config.mjs:78-83` (the `createMDX` call using them). Confirmed present as deps in `package.json:73` (`@stefanprobst/rehype-extract-toc`), `package.json:134` (`rehype-slug`), `package.json:137` (`remark-gfm`). |
| Article producer: new `extract_headings_from_content(content, levels)` in `src/lib/editor-utils.ts`, alongside `extract_media_refs_from_content`/`get_heading_from_editor` | Confirmed pattern to follow. Both existing functions are present today: `get_heading_from_editor` at `src/lib/editor-utils.ts:9-27`, `extract_media_refs_from_content` at `src/lib/editor-utils.ts:60-84` (overloaded per media type, filters `content.blocks` by `block.type`). New function should mirror this filter-by-`block.type === "header"` style. |
| "Excludes the first block (article H1), already stripped via `.slice(1)` in editor-to-react.tsx" | Confirmed: `src/components/editor/editor-to-react.tsx:79` -- `blocks: article.content.blocks.slice(1), // remove first heading`. |
| Anchor slugging: reuse `convert_title_to_url` from `src/lib/article-utils.ts` | Confirmed function exists, `src/lib/article-utils.ts:14-52`. Lowercases, strips HTML/unsafe chars via `sanitize-html` + `sanitize-filename`, maps c-hacek/s-hacek/z-hacek to c/s/z, collapses whitespace/hyphens, falls back to a `uuid4()` if the result is empty (`article-utils.ts:50`). Risk: this uuid4 fallback is meant for filenames (its other caller is `convert_filename_to_url`, `article-utils.ts:7-12`) -- a heading TOC-slugger reusing it verbatim would produce a random UUID anchor for any heading that sanitizes to nothing (punctuation/emoji-only) -- a legal, if unusual, heading. Not a blocker, just note this is inherited behavior, not new baggage from this ticket. |
| Article rendering: custom `header` `RenderFn` added to `renderers` in `editor-to-react.tsx`, "same pattern as existing image/attaches renderers" | Confirmed pattern: `renderers={{ image: NextImageRenderer, attaches: AttachesRenderer }}` at `src/components/editor/editor-to-react.tsx:117-120` and `:139-142` (duplicated between the two responsive card variants -- see cleanup note below). `RenderFn` type imported from `editorjs-blocks-react-renderer` (`editor-to-react.tsx:5`), version `^1.3.0` (`package.json:97`). |
| Mount points: `#shell-aside` (`src/components/shell/index.tsx`), `#mobile-toc` (`src/components/shell/mobile-header.tsx`, inside `MobileSheet`) | Both confirmed to exist, both confirmed currently unused (no `getElementById`/portal consumer in the codebase besides the dead `toc-scroll.tsx`). `#shell-aside`: `src/components/shell/index.tsx:53-61`. `#mobile-toc`: `src/components/shell/mobile-header.tsx:174`. See section 4 below for a real gap in how `#mobile-toc` is currently gated. |
| `show_aside` wired to `true` from `novica/[published_url]/page.tsx` and `(static)/layout.tsx` | Confirmed not yet wired. Neither file passes `show_aside` today: `src/app/novica/[published_url]/page.tsx:72` (`<Shell published_article={new_view}>`, no `show_aside`), `src/app/(static)/layout.tsx:13` (`<Shell>`, no props at all). |
| Mobile close-on-navigate via `mobile_nav_store.setState({ open: false })` | Store exists but the ticket's exact API call is wrong. `mobile_nav_store` is a `zustand-x` store (`createStore`, not raw zustand), defined at `src/components/shell/mobile-header.tsx:42-49`. Every existing call site uses `.set("open", false)` (e.g. `mobile-header.tsx:169`, and the dead `toc-scroll.tsx:117`), not `.setState({ open: false })` -- `setState` is not the zustand-x store API used elsewhere in this codebase. Use `.set("open", false)` for consistency. |
| Scroll behavior: smooth-scroll matches `AnchorProvider`'s built-in `scrollIntoView` | Partially confirmed, with a nuance: the ported `TOCItem`'s `autoScroll` (see section 2) scrolls the TOC list container (via `ScrollProvider`'s `containerRef`) into view of the active link -- it does not itself scroll the main document to the clicked heading. The document-level jump comes for free from the anchor being a real `<a href="#id">` (native browser anchor-scroll on click), not from fumadocs' JS. If a non-native (custom smooth) scroll is wanted, that is `element.scrollIntoView({ behavior: "smooth" })` called manually on click, separate from what is ported. Worth deciding explicitly (see section 4 open questions). |
| Empty-TOC handling: render nothing | Not yet implemented anywhere; straightforward, no existing conflicting pattern found. |
| Delete `toc-scroll.tsx` in full | Confirmed still present and unused (`grep -r toc-scroll src` -> only the file itself, no importers). Current content matches the ticket's description almost exactly (hand-rolled `handle_anchor_highlighting` at `src/components/static/toc-scroll.tsx:32-91`, `// TODO: hack` `setTimeout` at `toc-scroll.tsx:176-183`, `<p>what</p>` fallback at `toc-scroll.tsx:235`). See section 0 note: a large chunk of this feature's earlier iteration (`toc.tsx`, `toc-one.tsx`, `use-smooth-scroll.tsx`) was already deleted in commit `736929d` ("authors, removed toc", 2026-07-19) -- `toc-scroll.tsx` itself survived that cleanup pass only partially trimmed (its `useSmoothScroll()` call and per-click `smooth_scroll_store` wiring were stripped, replaced with the current `onClick={() => mobile_nav_store.set("open", false)}` at `toc-scroll.tsx:117`, but the rest of the dead machinery -- the `setTimeout` hack, the hand-rolled scroll math -- was left in place). |

## 2. fumadocs `toc.tsx` primitives -- exact API

**Verified against real local source** at `vendor/fumadocs/packages/core/src/toc.tsx`
(349 lines), submodule pinned at commit `1a50aa38a05a7399d26d8a10d74c6909111735ef`
(`fumadocs-core@16.11.5`) -- matches the initial GitHub-`main`-sourced claims below
exactly, with one addition noted at the `TOCItem` bullet.

Exports:

- `interface TOCItemType { title: ReactNode; url: string; depth: number; _step?: number }` -- **not** `{ id, title, depth }` as the ticket's shared `TocEntry` shape implies. It is `url` (expected to be `"#the-id"`), not a bare `id`. The port's adapter from `TocEntry` to `TOCItemType` needs `url: "#" + entry.id`.
- `type TableOfContents = TOCItemType[]`
- `interface TOCItemInfo { id: string; active: boolean; t: number; fallback: boolean; original: TOCItemType }` -- internal per-item runtime state (id parsed out of `url`, active/timestamp/fallback tracked by the `Observer`).
- `interface AnchorProviderProps { toc: TOCItemType[]; single?: boolean; children?: ReactNode }`
- `interface ScrollProviderProps { containerRef: RefObject<HTMLElement | null>; children?: ReactNode }`
- `AnchorProvider({ toc, single, children })` -- creates one `Observer` instance via `useMemo`, calls `observer.setItems(toc)` on toc change, calls `observer.watch({ threshold: 0.9 })` on mount / `unwatch()` on unmount. Provides the observer via React context (`ObserverContext`).
- `ScrollProvider({ containerRef, children })` -- optional, purely provides a `RefObject` via `ScrollContext`; only used by `TOCItem`'s "auto-scroll the TOC panel to keep the active link visible" behavior, not for scrolling the document.
- `TOCItem({ ref, onActiveChange, autoScroll = true, ...props }: ComponentProps<"a"> & { onActiveChange?; autoScroll?: boolean })` (`toc.tsx:85-95`) -- renders `<a ref={mergeRefs(anchorRef, ref)} data-active={active} {...props} />`. Derives `id` from `props.href` (`getItemId`: strips leading `#`, returns `null` if `href` does not start with `#`). Subscribes to `useTOCListener`; on active-state change, if `autoScroll` (public prop, default `true`, disable via `autoScroll={false}`) and this item just became the most-recently-activated one, calls the npm package `scroll-into-view-if-needed` to scroll the TOC list container (from `ScrollContext`), not the document, with `block: "center", inline: "center", boundary: container, behavior: initial ? "instant" : "smooth", scrollMode: "always"` (`toc.tsx:124-130`).
- Hooks: `useTOC()` (returns `{ get, listen, unlisten }`), `useTOCListener(listener)`, `useTOCSelector(select, isEqual?)`, `useActiveAnchor(): string | undefined`, `useActiveAnchors(): string[]`, `useItems(): TOCItemInfo[]`.
- `Observer` class (not exported) -- the actual IntersectionObserver logic. `setItems` diffs and re-observes DOM elements by `document.getElementById(id)`; `watch(options?)` creates one shared `IntersectionObserver` for all items; the intersection `callback` marks items `active` based on `entry.isIntersecting`, with a fallback path: if nothing is intersecting, it picks the item whose `getBoundingClientRect().top` is closest to `entries[0].rootBounds.top` and marks it active with `fallback: true`. `single` mode (if `AnchorProviderProps.single` is true) restricts to at most one simultaneously-active item.

Confirmed zero MDX coupling -- the whole file only touches
`document.getElementById`, IntersectionObserver, and the
`TOCItemType`/`TableOfContents` shapes above; nothing remark/rehype/mdx
specific. Matches the ticket's claim.

Extra dependencies needed to port (beyond this one file) -- not called out
in the ticket, all confirmed against real local files:

- npm package `scroll-into-view-if-needed` -- imported at `vendor/fumadocs/packages/core/src/toc.tsx:14`, used by `TOCItem`'s `autoScroll`. Confirmed as a real dependency of `fumadocs-core` (`vendor/fumadocs/packages/core/package.json`: `"scroll-into-view-if-needed": "^3.1.0"`, peer `"react": "^19.2.0"`) but not currently in this repo's own `package.json` (`grep scroll-into-view package.json` -> no hits). Either add it, or replace that one call site with native `element.scrollIntoView({ behavior, block: "center", inline: "center" })` (loses the `boundary`/container-scoping behavior, which matters if the TOC list itself scrolls independently, e.g. inside the existing `ScrollArea` wrapper pattern used elsewhere, see `toc-scroll.tsx:149-160`).
- `mergeRefs` util, imported from `@/utils/merge-refs` at `toc.tsx:15`, resolving to `vendor/fumadocs/packages/core/src/utils/merge-refs.ts` -- trivial ~8-line ref-merging helper, needed because `TOCItem` accepts both an internal `anchorRef` and a forwarded `ref` prop (React 19 ref-as-prop, no `forwardRef`).
- `isEqualShallow` util, imported from `./utils/is-equal` at `toc.tsx:16`, resolving to `vendor/fumadocs/packages/core/src/utils/is-equal.ts` -- trivial shallow-equality helper used as `useTOCSelector`'s default `isEqual`.
- React version requirement: `useEffectEvent` is imported directly from `react` at `toc.tsx:9` and used at `toc.tsx:166` (a React 19.2+ API), alongside the `use()` hook and ref-as-a-regular-prop (no `forwardRef`) -- all React 19.x+ patterns. This repo pins `react@19.2.7`/`react-dom@19.2.7` (`package.json:125` and adjacent), which satisfies `fumadocs-core`'s own peer requirement (`^19.2.0`) -- compatible, no smoke-test caveat needed beyond normal integration testing.

## 3. `@stefanprobst/rehype-extract-toc` -- confirmed API

**Verified against real shipped types**, read directly from
`node_modules/@stefanprobst/rehype-extract-toc/src/index.d.ts` and
`.../src/mdx.d.ts` (the package's `package.json` points `types` straight at
`./src/index.d.ts` -- there is no separate `dist/`, so source *is* the
shipped artifact). Installed version confirmed `3.0.0`
(`node_modules/@stefanprobst/rehype-extract-toc/package.json`), matching
`package.json:73`'s `^3.0.0` pin. Matches the original README-sourced claims
exactly -- no corrections needed, only firmer citations below.

- Rehype plugin; stores its result on `file.data.toc`, does not generate `id`s itself -- must be paired with `rehype-slug` (confirms the ticket's "finish wiring `rehype-slug` + ... `rehype-extract-toc`" framing).
- Shape (`src/index.d.ts`):

  ```ts
  export interface TocEntry { value: string; depth: number; id?: string; children?: Array<TocEntry> }
  export type Toc = Array<TocEntry>;
  declare const withExtractedTableOfContents: Plugin<[]>;
  export default withExtractedTableOfContents;
  declare module "vfile" { interface DataMap { toc: Toc } }
  ```

  This is a nested tree (`children`), not a flat list -- matches what
  `toc-scroll.tsx` currently assumes (`toc-scroll.tsx:14-27`'s recursive
  `get_heading_ids`), and the ticket's adapter step "converting that `Toc`
  shape into `TocEntry[]`" is necessary precisely because this is nested and
  the new shared shape is flat.
- MDX integration (`src/mdx.d.ts`):

  ```ts
  export interface RehypeExportTocMdxOptions { name?: string } // @default 'tableOfContents'
  declare const withExportedTableOfContents: Plugin<[RehypeExportTocMdxOptions?]>;
  export default withExportedTableOfContents;
  ```

  `@stefanprobst/rehype-extract-toc/mdx`'s default export is a rehype plugin (used positionally last in the `rehypePlugins` array, after `withSlugs`/`withToc`) that adds a named export to the compiled MDX module -- default export name `tableOfContents`, configurable via `[withTocExport, { name: "toc" }]`. `next.config.mjs`'s commented-out block (`next.config.mjs:9-13, 78-83`) already has this exact three-plugin order right (`withSlugs, withToc, withTocExport`).
- Consuming a compiled `.mdx` file's `tableOfContents` export requires an ambient `mdx.d.ts` declaration augmenting `*.mdx` modules to declare that named export -- not currently present anywhere in this repo (`grep -r "declare module.*mdx" src` -> no hits; only `@types/mdx` in `package.json:82`, which types the default `MDXContent` export and `frontmatter`, not a custom `tableOfContents` export). This will need adding as part of implementation, not just the `next.config.mjs` rehype pipeline.

## 4. Open questions / risks for implementation

1. **Confirmed (2026-07-20, by the repo maintainer): `mdxRs` still does not support custom rehype/remark plugins.** `next.config.mjs:29-34` has `experimental.mdxRs: { mdxType: "gfm" }` currently active, while the commented-out `createMDX({ options: { rehypePlugins: [...] } })` block sits unused below it (`next.config.mjs:78-89`). Next's Rust-based MDX compiler is a separate code path from the JS-based `@mdx-js/mdx` pipeline that `rehypePlugins`/`remarkPlugins` actually run through, and it does not execute arbitrary unified/rehype/remark plugins. **Implication: `mdxRs` must be disabled (or the static-page MDX compilation routed through a non-`mdxRs` path) for `rehype-slug`/`rehype-extract-toc` to run at all.** This is a real build-perf tradeoff to flag explicitly to whoever implements this ticket, not just a hypothetical risk.
2. `#mobile-toc`'s current mount is gated by a route-link-active check that does not cover `/novica/*`. `src/components/shell/mobile-header.tsx:174`: `{link.active && <div id="mobile-toc" />}`, where `link.active` comes from `pathname.includes(link.href)` (`mobile-header.tsx:112-119`) against `MOBILE_NAV_LINKS` (`mobile-header.tsx:91-98`: `zgodovina`, `raziskovanje`, `publiciranje`, `varstvo`, `klub`, `arhiv`). None of these match `/novica/[published_url]` -- so as currently coded, the `#mobile-toc` portal target never mounts on an article page, only on the five static pages (and only when the pathname happens to literally contain one of those words). User story 4 explicitly wants mobile TOC on published articles too. This needs a real fix (e.g. render `#mobile-toc` unconditionally, or key it off "does this page have a non-empty TOC" the same way `show_aside` is meant to be), not just "reuse the existing mount."
3. Exact H2/H3 level choice -- the ticket explicitly punts this ("a call to make during implementation, not fixed here"). Given `zgodovina/page.mdx` structure sampled (`src/app/(static)/zgodovina/page.mdx:5-7`: one `#` H1 title plus many `##` H2 year-headings, no visible `###` in the sampled portion), confirm whether any static page actually uses H3 before committing to including it -- grep all five `page.mdx` files for heading depth distribution first.
4. Dedupe algorithm details (numeric suffix `-2`, `-3`, ...) are not specified beyond "add a dedupe pass" -- need to pin down: is uniqueness scoped per-document (obviously) and is the first occurrence left unsuffixed (typical GitHub-style) or do all get suffixed uniformly? `rehype-slug`'s own behavior (delegates to `github-slugger`, first-occurrence-unsuffixed) is the de facto standard the article-side dedupe pass should probably mirror for "slugging philosophy" consistency per the ticket's own Out-of-Scope carve-out.
5. `#shell-aside` is currently styled as a full-viewport `fixed` overlay, not a sidebar column -- `src/components/shell/index.tsx:53-61`: `className="fixed flex h-full w-full items-center justify-center"` (only `!show_aside && "hidden"` is conditional). This is dead styling nobody has actually laid out as a 300px sidebar yet -- `<main>`'s complementary `md:ml-[300px]` (`index.tsx:65-66`) assumes a 300px-wide aside, but `#shell-aside` itself does not currently constrain to that width, position it `fixed left-0`, or scroll independently. Whoever implements this needs to actually build that layout, not assume it already works -- the ticket's "reuse the existing portal target" undersells how unfinished this CSS is.
6. Scroll-to-heading behavior is ambiguous between native anchor scroll and JS `scrollIntoView` -- see section 1's table row on this; needs an explicit implementation decision (native `<a href="#id">` browser default vs. manual `element.scrollIntoView({ behavior: "smooth" })` on click) since fumadocs' own `scrollIntoView` usage inside `TOCItem` scrolls the TOC panel, not the document.
7. `useEffectEvent` React-version risk -- see section 2; worth a very early smoke test of the ported file against this repo's exact `react@19.2.7`/`react-dom@19.2.7` before investing in the rest of the port.
8. No ambient `.mdx` type declaration for a custom `tableOfContents` export exists yet -- see section 3, last bullet; needed alongside the `next.config.mjs` wiring, not mentioned in the ticket's Implementation Decisions.
9. `convert_title_to_url`'s uuid4 fallback (section 1, `article-utils.ts:50`) means a heading whose text sanitizes to nothing (e.g. emoji/punctuation only) gets a random, non-deterministic anchor id on every extraction -- harmless in practice (headings are almost always real words) but worth being aware of if `extract_headings_from_content` is unit-tested for determinism.

## 5. Cleanup opportunities found but not in the ticket

- `src/components/editor/editor-to-react.tsx:222` -- a real bug, not just style: inside `AttachesRenderer`'s `backgroundColor`/`extension` `useMemo`s, the extension-truncation branch reads `` `${extension.substring(0, EXTENSION_MAX_LENGTH)}...` `` -- but `extension` there refers to the outer `const extension = useMemo(...)` binding that is still being initialized (self-reference inside its own initializer), which throws `ReferenceError: Cannot access "extension" before initialization` for any attaches file whose extension is longer than `EXTENSION_MAX_LENGTH` (4) chars. Should read `data.file.extension.substring(...)` instead. This sits directly adjacent to the `header`-renderer work this ticket adds to the same `renderers` map.
- `src/components/editor/editor-to-react.tsx:114-122` and `:136-144` -- the `<ArticleLinksInNewTab><Blocks data={editor_data} renderers={{ image: ..., attaches: ... }} /></ArticleLinksInNewTab>` block is duplicated verbatim between the desktop (`Card`) and mobile (`div`) branches, differing only in the wrapping container. Adding the ticket's new `header` renderer means editing this `renderers` object in two places by hand; worth factoring the shared subtree out into one element/variable before or during this ticket to avoid the two call sites silently drifting.
- `src/components/shell/mobile-header.tsx:126` -- `console.log("setting mobile nav open", new_state)` left in `onOpenChange`; stray debug log on every mobile-sheet toggle, unrelated to but visible while implementing the mobile close-on-navigate story.
- `src/components/static/toc-scroll.tsx:176-183` -- the `// TODO: hack` `setTimeout(..., 100)` polling for `#mobile-toc` (plus a `console.log("setting mobile_ref", mobile_ref)`) -- the ticket already flags this file for full deletion; just confirming it is exactly as described and the whole 237-line file is safe to delete outright once the replacement lands, no other importers (`grep -r toc-scroll src` -> only self).
- `scripts/generate_toc.ts` (wired to `bun run toc`, `package.json:22`) -- a completely separate, disconnected TOC mechanism: a standalone script that walks `src/app/(static)/*/page.mdx`, parses headings with `remark-parse` + `remark-mdx`, and writes a static `toc.json` to the repo root via `fs.writeJson` (not consumed anywhere at runtime -- `grep -r toc.json src` -> no hits, and `toc.json` does not exist in the working tree). It also uses `camelCase` naming (`extractHeadings`, `mdxDirectory`, `outputFilePath`) inconsistent with the rest of the codebase's `snake_case` convention (e.g. `convert_title_to_url`, `extract_media_refs_from_content`). This script predates and is now made fully redundant by this ticket's static-page producer; worth deleting (or at least flagging to the user) once the MDX toc pipeline is wired for real, so there are not two independent, drifting TOC-extraction mechanisms for the same five files.
- `package.json` -- several MDX-ecosystem deps appear installed but unused anywhere in `src/` (grep for each returned no hits outside `next.config.mjs`'s commented block and `scripts/generate_toc.ts`): `remark-extract-toc` (`package.json:135`, a different package from the one this ticket actually wires up, `@stefanprobst/rehype-extract-toc` -- worth not confusing the two when implementing), `rehype-minify-whitespace` (`package.json:133`), `remark-frontmatter`/`remark-mdx-frontmatter` (`package.json:136,138`, referenced only in a second commented-out block at `next.config.mjs:14-15`). Likely leftovers from the earlier abandoned toc/mdx/autocomplete experimentation visible in `git log` (`f1ff9a4 toc works, a bit glitchy`, `efb868b mdx doesn't work with turbo, test mdx toc`, etc.) -- not blocking, but worth a pass to remove genuinely-dead deps either alongside or after this ticket.
- `src/app/uredi/[draft_id]/image-selector.tsx:1` -- `// "use client";` is commented out, even though the component uses `useState`/`useEffect`/refs throughout. It currently works only because a client-boundary ancestor already covers it, but the dead, commented directive reads as an unresolved TODO/uncertainty rather than an intentional choice -- worth either deleting the comment or restoring the directive for clarity.
- `src/components/editor/editor-context.tsx:138-146` -- `onChange: (_, event) => { if (Array.isArray(event)) { for (const {} of event) { onChange(); } } else { onChange(); } }`: iterates a batch of change events purely to call the same idempotent `onChange()` (which just does `setDirty(true)`) once per event, when the array-length distinction has no observable effect -- could collapse to calling `onChange()` unconditionally regardless of whether `event` is single or batched.
- `src/components/shell/desktop-header.tsx:54-98` -- a hand-rolled `window.addEventListener("scroll", ...)` + `clientHeight` comparison to toggle `is_header_sticky` (with a `// TODO: + 2 is a hack for the separator` at line 59), structurally the same "manual scroll math instead of a declarative primitive" smell the ticket calls out in `toc-scroll.tsx`. Not in scope for this ticket, but worth noting as the same pattern recurring nearby -- a `position: sticky` CSS approach or an `IntersectionObserver` on a sentinel element would remove this scroll-listener entirely, similar in spirit to what this ticket does for the TOC scroll-spy.