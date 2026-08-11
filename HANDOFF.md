# Handoff: mobile "On this page" TOC rework

Session focus: redesigning JKNM's mobile hamburger sidebar (per `TODO.md`'s
"improve mobile" item), which morphed into rebuilding the mobile TOC
("On this page") trigger through three shapes — Sheet → Drawer →
fumadocs-style popover — and, in the last stretch, uncovering a real bug in
shared article-rendering code that the popover work exposed but didn't
cause. **That bug is unfixed and is the right place to pick back up.**

## Where things stand

Working tree has uncommitted changes (already `git add`-ed, not committed —
nothing has been committed this session, do not assume otherwise from the
staged state):

- `src/components/shell/mobile-header.tsx` — mobile header rebuilt: hamburger
  sheet restyled into labelled sections (nav links / socials / sponsors,
  fixing an overflow bug and a sponsor-alignment bug from the original ask),
  plus a new `MobileTocPopover` for "On this page".
- `src/components/toc/table-of-contents.tsx` — added `ActiveAnchorSync`,
  wired `entries`/active-id into a new store.
- `src/components/toc/toc-store.ts` — added `mobile_toc_progress_store` /
  `useMobileTocProgress()`.
- `src/components/toc/fumadocs-toc.tsx` — patched the scroll-spy fallback to
  skip zero-size (hidden) elements; **still has a temporary debug
  `console.log` at line ~345 (`"[toc-debug] observer update"`)**.
- `src/components/shell/index.tsx` — mobile header's own spacer div replaced
  the old static `h-20` on the shared `<header>`.
- `src/components/ui/collapsible.tsx` — new, shadcn-installed passthrough.
- `src/styles/globals.css` — added `collapsible-down`/`up` keyframes.
- `toc.log` (repo root, staged) — the user's pasted debug console output from
  this session. Not meant to be committed; delete or `git restore --staged`
  it before committing.
- `table-of-contents.tsx` line ~31 also still has a temporary debug
  `console.log` (`"[toc-debug] ActiveAnchorSync active_ids"`).
- `bun.lock` / `package.json` diffs are just the `@radix-ui/react-collapsible`
  shadcn install — expected, not accidental.
- `vendor/editorjs/` and `vercel excalidraw.png` (untracked) predate/are
  outside this session's work — leave alone.

Typecheck, lint, and the 214-test suite were all verified clean **before**
the two debug `console.log`s were added; they haven't been re-run since (the
logs won't fail lint/tsc but re-verify after removing them).

## Design decisions already made and confirmed by the user (don't re-litigate)

1. Split the hamburger sheet into two independent header triggers: hamburger
   (site nav/socials/sponsors) and a separate "On this page" TOC trigger —
   modeled on Vercel's docs header (user's own annotated reference screenshot
   was `vercel excalidraw.png` at repo root, since read and internalized, not
   needed again).
2. The TOC trigger went through three shapes on user feedback, landing on a
   **fumadocs-style popover row**: a sticky/fixed row below the navbar whose
   trigger shows a `ProgressCircle` (reading-progress ring) and a label that
   cross-fades between "Na tej strani" and the current active heading's
   title. Reference source actually studied: `vendor/fumadocs/packages/
   radix-ui/src/layouts/docs/page/slots/toc.tsx` (the `TOCPopover`,
   `PageTOCPopoverTrigger`, and `ProgressCircle` — all ported/adapted, not
   just skimmed).
3. Confirmed via debugging this session: fumadocs' own popover panel is a
   **floating overlay** (`position: absolute`, fixed-height trigger row),
   *not* an in-flow block that pushes page content down — my first
   implementation wrongly assumed push-down, built a `ResizeObserver` to
   support it, and that observer (firing every frame of the ~200ms open/close
   animation, each time forcing a page reflow via an inline-styled spacer)
   was the reported jank. Both are now fixed: the panel floats
   (`MobileTocPopover`'s `CollapsibleContent` uses `absolute inset-x-0
   top-full`), and the header's reserved spacer height is measured once
   (on breakpoint change / `has_toc` change) instead of continuously.
4. Added click-outside-to-close on the popover (mirroring fumadocs'
   `onClickOutside`) since floating overlays need it and Radix `Collapsible`
   doesn't provide it for free.

## The unresolved bug — start here

**Symptom:** the popover's progress ring stays at 0% and the label never
shows anything but the static "Na tej strani" text (earlier reports of it
being stuck on "H1" were a symptom of the same root cause, not a separate
issue) — nothing updates while scrolling, ever, not even briefly.

**Root cause, confirmed via debug logging (see `toc.log` for the raw
capture):** `src/components/editor/editor-to-react.tsx` (around line
168-210) renders `<ArticleBody blocks_data={blocks_data} />` **twice** — once
inside a `hidden md:block` wrapper (desktop) and once inside a `md:hidden`
wrapper (mobile) — both fed the *same* `blocks_data`, so every heading's
`id` (and the article's `h1_id`) is duplicated verbatim in both DOM copies.
`document.getElementById()` always resolves to the *first* matching element
in document order (the desktop copy), which is `display:none` on mobile.
So the `IntersectionObserver` in `fumadocs-toc.tsx` ends up watching
invisible, zero-size desktop clones of every heading — they can never
intersect anything, hence the frozen 0%/static-label symptom exactly matches
the captured log (two synchronous empty updates from mount, then nothing,
ever, regardless of scrolling).

**Likely related, not yet verified:** clicking a TOC link on mobile
(`href="#slug"`) probably also silently fails to scroll to the right place,
for the same `getElementById`-resolves-to-the-hidden-copy reason. Worth
checking early in the next session.

**Not the cause, but a legitimate fix already applied and worth keeping:**
the `fumadocs-toc.tsx` fallback-selection patch (skip zero-rect elements
when picking a "closest heading" fallback) — this guards against the same
duplicate-id class of bug in general and should stay even after the real fix
lands, since it's cheap insurance.

**Recommended fix, not yet implemented:** stop duplicating `ArticleBody` (and
ideally the `<h1>`) in the DOM. Render each once; let only the *wrapper*
chrome differ responsively via CSS (e.g. `Card`+`CardHeader` styling on
desktop vs. a plain `div` on mobile), rather than duplicating the whole
subtree per breakpoint. This touches shared article-rendering code used by
every content page and news article — bigger blast radius than the TOC
feature itself, which is why it was flagged to the user rather than fixed
outright. **The user has not yet said go/no-go on this fix** — that's the
open question to bring back to them.

## What the next session needs to do

1. Get the user's go-ahead (or specific direction) on de-duplicating
   `ArticleBody`/`<h1>` in `editor-to-react.tsx`.
2. Implement it, then remove the two temporary `console.log("[toc-debug]
   ...")` lines (`table-of-contents.tsx` ~line 31, `fumadocs-toc.tsx` ~line
   345) — they were left in deliberately for this handoff/for one more round
   of verification, not forgotten.
3. Re-verify on-device: progress ring should move and the label should swap
   to the active heading as the user scrolls; also sanity-check that a
   mobile TOC link click now scrolls to the right heading.
4. Re-run `bunx tsc --noEmit`, `bun run lint`, `bun run test` (were clean as
   of the last check; nothing since should have broken them, but confirm).
5. Only after the user is happy with on-device behavior: follow the
   `/implement` skill's tail end — code review, then commit. Nothing in this
   session has been committed yet.
6. Delete or unstage `toc.log` before committing (it's disposable debug
   output, not part of the feature).

## Suggested skills

- `/implement` — once the de-dup fix lands and is verified, this is the
  natural wrapper for the remaining review-and-commit steps (it's already
  the skill this whole feature has been built under).
- `codebase-design` — if the `ArticleBody` de-duplication turns out to need
  a broader rethink of how `EditorToReact` handles responsive layout (rather
  than a small in-place fix), this is worth loading before redesigning that
  component.
