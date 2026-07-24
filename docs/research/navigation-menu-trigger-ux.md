# Research: `NavigationMenuTrigger`'s hover/click race workaround

> **Status (2026-07-23): active investigation, no source changes made.** This file is
> investigation only, prompted by a deferred production bug: the navbar's `/arhiv` link
> (a plain, content-less trigger) has, on at least one report, had its click silently
> cancelled -- Chrome showed the link target in the status bar but navigation never
> happened. The reporter could not reproduce it themselves. Citations below are
> repo-relative paths (including into the `vendor/radix-ui-primitives` submodule) or the
> fetched URL for anything sourced from GitHub/the public docs.

## Summary

- `src/components/navigation-menu-trigger.tsx:28-77`'s `MutationObserver`/`disable`-flag
  workaround is a close, working adaptation of exactly one specific GitHub comment
  (`radix-ui/primitives#1630`, comment `1545995075`, posted 2023-05-12 by `JohnGemstone`).
  The comment's description of the bug and its suggested "hack" match this file's
  behavior almost exactly -- see section 1.
- The upstream issue (`#1630`, filed 2022-08-26) is **still open** as of its most recent
  comment (2025-08-27); there is no first-party `openOnHover`/click-only prop shipped in
  any released version of `@radix-ui/react-navigation-menu`. See section 2.
- However, Radix's `navigation-menu.tsx` source **already has, and has had since the
  component's original 2022-02-23 introduction**, its own first-party click/hover
  reconciliation logic (`wasClickCloseRef`, later joined by `hasPointerMoveOpenedRef` in
  2022-10-14) that is a different, narrower mechanism from this repo's `MutationObserver`
  hack. Whether that first-party logic alone would have been sufficient to avoid needing
  the custom workaround is not something this research can determine without live
  behavioral testing -- see section 2 for exactly what it does and does not cover.
- A **brand-new, not-yet-released** upstream feature -- `activationMode="manual"` (plus a
  `disableToggle` prop) -- landed in the submodule's `main` branch on 2026-07-20 (commit
  `a6640ab5432a60eee3f33a9f8316e17ef62eac11`, PR #4011), three days before this research.
  It is the closest thing to a first-party fix for the underlying UX problem, but it is
  unpublished: the submodule's own `CHANGELOG.md` and `package.json` still show `1.2.20`
  with no entry for it, its two changesets remain uncommitted/unconsumed on `main`, and
  the public docs site does not document it. See section 2.
- Radix's `NavigationMenu` does **not** implement the "safe triangle" / `safePolygon`
  pointer-intent pattern. That pattern exists elsewhere in the same monorepo (`Menu`,
  `Tooltip`) but is absent from `navigation-menu.tsx`; `NavigationMenu` instead uses a
  flat, non-geometric 150ms close-delay timer on pointer-leave. See section 3.
- Radix's own docs offer very little UX guidance beyond the `delayDuration`/
  `skipDelayDuration` prop defaults and the `asChild`-composition pattern this repo
  already follows for its `Link` wrapping. See section 4.

## 1. The linked GitHub issue and comment -- exact content

Fetched via `gh issue view 1630 -R radix-ui/primitives --comments` and
`gh api repos/radix-ui/primitives/issues/comments/1545995075`.

- **Issue**: [`radix-ui/primitives#1630`](https://github.com/radix-ui/primitives/issues/1630),
  "[NavigationMenu] Option to open navigation menu on click instead of pointer enter",
  opened 2022-08-26, state **OPEN** (still open, confirmed as of the most recent comment
  dated 2025-08-27 -- 38 comments total).
- **The specific comment cited in this repo's code comment**
  (`https://github.com/radix-ui/primitives/issues/1630#issuecomment-1545995075`), posted
  by `JohnGemstone` on 2023-05-12T16:25:07Z (20 :+1: reactions), verbatim:

  > I've found that a lot of mouse users will instinctively click the menu triggers to
  > open them, which will close the menu as their "hover" state has already triggered the
  > menu to open.
  >
  > Here is [Theo](https://twitter.com/t3dotgg) exhibiting this behaviour a few months
  > ago. [video link]
  >
  > A hack is to create mutation observers which listen to the `data-state` attributes of
  > the trigger elements and prevent any onClick events within a given interval.
  >
  > https://codesandbox.io/p/sandbox/peaceful-nobel-gmlbyy?file=%2FApp.tsx
  > (codesandbox typescript is weird so this example isnt fully typesafe)
  >
  > While it's a bit messy this should give the best of both click and hover worlds. If
  > anyone can foresee any problems with this let me know!

- **Comparison to this repo's implementation** (`src/components/navigation-menu-trigger.tsx:28-77`):
  matches the comment's described shape closely -- a `MutationObserver` watching the
  trigger's `data-state` attribute, and a time-boxed "ignore clicks" window opened when it
  flips to `"open"`. The repo picks a concrete `1000ms` window where the comment leaves the
  interval unspecified ("a given interval"), and the repo additionally special-cases the
  case where the dropdown is *already* open before the observer's window starts
  (`navigation-menu-trigger.tsx:86-89`: if `hasContent && isOpen`, let the click through
  regardless of `disable`, since a click while already-open is read as deliberate,
  presumably to let a genuine click close/re-navigate an open dropdown) -- a refinement
  not discussed in the comment. The underlying primitive (a `MutationObserver` on
  `data-state` gating `onClick`) is otherwise a faithful, not just inspired-by, adaptation.
- An **earlier** comment on the same issue, by maintainer `andy-hook` (2022-09-05), proposed
  a different, event-suppression-based approach ("preventing the relevant pointer events on
  `trigger` and `content`", linking a CodeSandbox) and explicitly caveated it: "this is not
  perfect as it relies on understanding the implementation details (which may change in the
  future)." He tagged the issue "an improvement to explore" at that point -- i.e. the
  maintainers acknowledged the UX problem as real and worth fixing upstream over three years
  ago, but as of this research it remains unfixed in a released version (see section 2).
- The **most recent comments** (2025) show the community still working around the same gap
  with hand-rolled fixes, none endorsed as canonical:
  - `ryanskidmore` (2025-06-24): a shadcn/ui-style trigger overriding `onPointerMove`.
  - `BartSiedlecki` (2025-08-26): `<NavigationMenu delayDuration={1_000_000}
    skipDelayDuration={0}>` -- i.e. abusing `delayDuration` to make hover-open effectively
    never fire, so only click opens it. Confirms `delayDuration`/`skipDelayDuration` alone
    (available in every released version) cannot cleanly separate "click-only" behavior
    without this kind of abuse -- see section 2's note on why `activationMode` was later
    added to make this properly configurable.

## 2. Radix's built-in hover/click model, and the version-fix check

Read directly from the pinned submodule,
`vendor/radix-ui-primitives/packages/react/navigation-menu/src/navigation-menu.tsx` (1403
lines). Submodule pinned at commit `3a6714c9e892f24b43bb533c4e199d300e2a6b48`
(2026-07-22), `packages/react/navigation-menu/package.json` version `1.2.20`. This repo's
own pin is `"@radix-ui/react-navigation-menu": "^1.2.17"` (`package.json:63`), and the
installed copy in `node_modules/@radix-ui/react-navigation-menu/package.json` is exactly
`1.2.17` -- three patch versions behind the submodule's `1.2.20`, but per the submodule's
own `CHANGELOG.md`, versions 1.2.18-1.2.20 contain no navigation-menu-trigger-relevant
behavior changes (CSS custom properties, tree-shaking/bundling changes, and a provenance
re-publish, respectively) -- so `1.2.17` and `1.2.20` are behaviorally identical for this
investigation's purposes.

### 2a. `NavigationMenu.Root`'s hover-open/close timers

`navigation-menu.tsx:129-209` (the `NavigationMenu` root component):

- `delayDuration` (default `200`ms, `navigation-menu.tsx:110`) and `skipDelayDuration`
  (default `300`ms, `navigation-menu.tsx:117`) are documented root props.
- `handleDelayedOpen` (`navigation-menu.tsx:183-195`) starts a timer of `delayDuration` ms
  before opening on pointer-enter, unless the menu was "recently" open (tracked via
  `isOpenDelayed`, flipped off for `skipDelayDuration` ms after the last close), in which
  case `handleOpen` fires immediately (`navigation-menu.tsx:176-181`).
- `startCloseTimer` (`navigation-menu.tsx:171-174`) is a **flat, hardcoded 150ms** timeout
  before calling `setValue('')` to close -- triggered from both `onTriggerLeave` and
  `onContentLeave` (`navigation-menu.tsx:230-245`).
- These open/close timers govern *hover* intent only; they say nothing about click
  handling, and none of this is configurable to distinguish "close because pointer left
  toward empty space" from "close because pointer left toward the dropdown content it's
  heading for" -- see section 3.

### 2b. `NavigationMenuTrigger`'s own click/hover reconciliation (first-party, pre-dates the issue)

`navigation-menu.tsx:560-658`. This is the part most directly comparable to this repo's
workaround, since it is Radix's *own* attempt to prevent the same click-immediately-after-hover-open
race, implemented with refs instead of a `MutationObserver`:

```ts
const hasPointerMoveOpenedRef = React.useRef(false);
const wasClickCloseRef = React.useRef(false);
...
onPointerEnter={... () => {
  wasClickCloseRef.current = false;
  itemContext.wasEscapeCloseRef.current = false;
}}
onPointerMove={... whenMouse(() => {
  if (disabled || wasClickCloseRef.current || itemContext.wasEscapeCloseRef.current || hasPointerMoveOpenedRef.current)
    return;
  context.onTriggerEnter(itemContext.value);
  hasPointerMoveOpenedRef.current = true;
})}
onPointerLeave={... whenMouse(() => {
  if (disabled) return;
  context.onTriggerLeave();
  hasPointerMoveOpenedRef.current = false;
})}
onClick={... () => {
  context.onItemSelect(itemContext.value);
  wasClickCloseRef.current = open;
}}
```

(`navigation-menu.tsx:571-617`.) `context.onItemSelect` (`navigation-menu.tsx:246-248`)
toggles: `setValue((prevValue) => (prevValue === itemValue ? '' : itemValue))` -- i.e. a
click on an already-open item's trigger closes it, by design (this is exactly the
"click-to-toggle" behavior the comment thread describes as surprising to users who just
hover-opened the same item and then click it expecting it to stay open or navigate).
`wasClickCloseRef` only records *that* a click closed the item, gating the *next*
`onPointerEnter` reset -- it does not prevent the closing click itself from firing.
`hasPointerMoveOpenedRef` deduplicates repeated `pointermove` events so a single hover
gesture only calls `onTriggerEnter` once, which is a jitter/perf guard, not a click-race
guard.

**Git history** (`git log --follow -p -- packages/react/navigation-menu/src/navigation-menu.tsx`
in the submodule): `wasClickCloseRef` was present in the component's very first commit,
`61549e9fae5b625e5ebe583a65f2c873cad1719a` ("[NavigationMenu] New primitive (#1172)",
2022-02-23) -- i.e. before issue `#1630` was even filed (2022-08-26). `hasPointerMoveOpenedRef`
was added later in `ed6f4897b6d4224c48fe0523ab4d4507fb76d7de` ("[NavigationMenu] Add
`delayDuration` and `skipDelayDuration` to `Root` (#1716)", 2022-10-14), also before the
GitHub-comment-cited workaround (2023-05-12). **Conclusion: this first-party logic existed
the whole time the GitHub issue was open and is evidently not what the issue's reporters
considered a fix** -- the issue's own body and every comment through 2025 describe the
click-immediately-closes-what-hover-just-opened problem as still reproducible, meaning
Radix's built-in refs mitigate a different symptom (double-firing `onTriggerEnter`,
stale escape-close state) than the one this repo's `MutationObserver` targets (suppressing
the closing click's *navigation*, i.e. `<a>` follow-through, entirely). This repo's
`hasContent` trigger wraps a `Link` and calls `e.preventDefault()` to stop navigation --
Radix's own logic never calls `preventDefault()` on click at all; it only toggles state.
So the two mechanisms are not redundant, and this research cannot determine, without live
behavioral testing, whether Radix's built-in refs alone would already prevent the "hover
opens, click immediately closes" flicker this repo's comment describes, only that they do
not prevent the *navigation* problem (a `hasContent=false` `Link`-following trigger firing
its href on an unwanted click) the way the custom workaround does.

### 2c. `activationMode`/`disableToggle` -- a real, but unreleased, upstream mechanism

`navigation-menu.tsx:126` (Root) and `:290` (Sub) define an `activationMode?: ActivationMode`
prop, `"automatic" | "manual"` (default `"automatic"`):

```
/**
 * Whether an item is activated automatically or manually.
 * - "automatic": hovering or focusing a trigger opens its item, and moving
 *   away closes it after a short delay.
 * - "manual": clicking a trigger toggles the item; hover and focus are ignored
 *
 * @default "automatic"
 */
```

(`navigation-menu.tsx:119-127`.) When `"manual"`, every one of `onTriggerEnter`,
`onTriggerLeave`, `onContentEnter`, `onContentLeave` becomes a no-op
(`navigation-menu.tsx:220-245`: each body is wrapped in
`if (activationMode === ActivationMode.Automatic) { ... }`), and opening/closing happens
only via `onItemSelect`'s click-driven toggle. This is the first-party mechanism closest to
what issue `#1630` asks for ("option to open navigation menu on click instead of pointer
enter") -- with `activationMode="manual"`, hover never opens anything, so the
hover-then-click race this repo's `MutationObserver` guards against cannot occur, because
there is no hover-open state to race against.

A sibling `disableToggle?: boolean` prop (default `true`) on `Sub`
(`navigation-menu.tsx:296,312,339`) separately controls whether clicking an already-open
item's trigger closes it (`disableToggle: true`, the default, keeps it open) or toggles it
closed (`disableToggle: false`) -- addressing the "click closes what I just opened" half of
the complaint independently of hover.

**Version/release status, checked directly against the submodule and this repo's lockfile
state:**

- The commit that introduces both props is
  `a6640ab5432a60eee3f33a9f8316e17ef62eac11`, "Navigation Menu: Add `activationMode` and
  `disableToggle` props (#4011)", authored by Chance Strickland, dated **2026-07-20** --
  three days before this research and confirmed (`git merge-base --is-ancestor`) to be an
  ancestor of the submodule's pinned HEAD (`3a6714c9e892f24b43bb533c4e199d300e2a6b48`,
  2026-07-22).
- Its two Changesets (`.changeset/eighty-baboons-go.md`, `.changeset/floppy-cloths-lay.md`,
  both `minor` bumps) are still present, **uncommitted into a version bump**, at the
  submodule's pinned HEAD -- Changesets' convention is that an unconsumed changeset file
  means the change has not yet been folded into a released version.
- Confirmed directly: `packages/react/navigation-menu/package.json` at the pinned HEAD
  still reads `"version": "1.2.20"`, and `packages/react/navigation-menu/CHANGELOG.md`'s
  top entry is still `## 1.2.20` with no mention of `activationMode` or `disableToggle`
  anywhere in the file. A later commit, `6eb41018bd0fecae845432dbb1aed33de482b6dc`
  ("New release (#4070) (#4071)", 2026-07-22, also an ancestor of the pinned HEAD) did cut
  a release, but not for `navigation-menu` (its changelog is unaffected) -- so whatever that
  release published, it was not this feature.
- The public docs site (fetched 2026-07-23,
  `https://www.radix-ui.com/primitives/docs/components/navigation-menu`) documents only
  `defaultValue`, `value`, `onValueChange`, `delayDuration` (default `200`),
  `skipDelayDuration` (default `300`), `dir`, `orientation` on `Root` -- confirmed **no**
  `activationMode` or `disableToggle` prop is documented there, consistent with the
  unreleased state found in the submodule.
- This repo's installed version, `1.2.17` (both the `package.json` pin and the
  `node_modules` copy), predates even the submodule's `1.2.20`, so it certainly does not
  have `activationMode`/`disableToggle` available today under any circumstance.

**This is the single most important finding for weighing options below**: the
"first-party mechanism that would make this workaround unnecessary" the task asked to
check for does exist in source as of three days ago, but it is not yet an installable
release -- there is no version number to `bun add`/pin to, and no guarantee of exactly
when (or whether, pre-1.0-style APIs can still change) it ships. It is not a
currently-actionable upstream fix, only a soon-possibly-actionable one.

## 3. Safe-triangle / safe-polygon findings -- definitive: absent from `NavigationMenu`

Searched the full submodule for `safePolygon`/"safe triangle"/`polygon` (case-insensitive):
only three files matched anywhere in the monorepo --
`vendor/radix-ui-primitives/packages/react/tooltip/src/tooltip.tsx`,
`vendor/radix-ui-primitives/packages/react/menu/src/menu.tsx`, and
`vendor/radix-ui-primitives/packages/react/arrow/src/arrow.tsx` (an unrelated SVG arrow
shape). **`navigation-menu.tsx` is not among them** -- zero occurrences of "polygon",
"grace", or "safe" in that file.

For contrast, `menu.tsx` (`vendor/radix-ui-primitives/packages/react/menu/src/menu.tsx:1150-1385`)
does implement exactly the geometric pattern the task asked about: a `Polygon`/`Point`
type, `isPointInPolygon` ("Based on https://github.com/substack/point-in-polygon"), a
`GraceIntent` computed from the pointer's bleed-adjusted position plus the submenu
content's bounding-rect corners (`menu.tsx:1150-1156`), and `isPointerInGraceArea` gating
whether a pointer-leave should actually close the submenu. This is Radix's dropdown
`Menu` primitive (used by e.g. `DropdownMenu`/`ContextMenu` submenus), not
`NavigationMenu`.

`NavigationMenu` instead relies purely on the flat timer scheme in section 2a: a shared
150ms `startCloseTimer` fired on either the trigger's or the content's `pointerleave`
(`navigation-menu.tsx:230-245`), cancelled if the pointer re-enters either the trigger or
the content before it fires (`onTriggerEnter`/`onContentEnter` both
`window.clearTimeout(closeTimerRef.current)`). There is no geometric reasoning about
pointer trajectory at all -- moving diagonally toward the dropdown just has to complete
within the 150ms window, regardless of direction.

**Definitive answer: Radix's `NavigationMenu` has neither a safe-polygon/safe-triangle
pointer-intent system nor any other trajectory-aware heuristic. It has a flat close-delay
timer only, and that timer is not configurable per-instance (150ms is hardcoded, not a
prop) as of the pinned/installed versions.**

## 4. Navbar UX recommendations sourced from Radix's own guidance

Fetched `https://www.radix-ui.com/primitives/docs/components/navigation-menu` (2026-07-23).

- **On the ARIA role choice** -- Radix's docs explicitly explain why `NavigationMenu`
  deliberately does *not* use the WAI-ARIA `menu`/`menubar` role, quoted verbatim:

  > NavigationMenu should not be confused with menubar, although this primitive shares the
  > name `menu` in the colloquial sense to refer to a set of navigation links, it does not
  > use the WAI-ARIA `menu` role. This is because `menu` and `menubars` behave like native
  > operating system menus most commonly found in desktop application windows, as such they
  > feature complex functionality like composite focus management and first-character
  > navigation.
  >
  > These features are often considered unnecessary for website navigation and at worst can
  > confuse users who are familiar with established website patterns.

  This is a direct, first-party statement that Radix intentionally diverges from the
  WAI-ARIA APG menu/menubar interaction pattern for this component, so that pattern's
  guidance (e.g. on hover-intent) is not the applicable reference here -- `NavigationMenu`
  is deliberately simpler than an APG menu/menubar by design, not an incomplete
  implementation of one.
- **On `Link` composition** -- the docs' own recommendation for exactly the pattern this
  repo uses (`asChild` + a nested framework `Link`, `navigation-menu-trigger.tsx:103`):

  > If you need to use the Link component provided by your routing package then we
  > recommend composing with NavigationMenu.Link via a custom component. This will ensure
  > accessibility and consistent keyboard control is maintained.

  This repo's `NavigationMenuTrigger` wraps `NavigationMenuPrimitive.Trigger asChild` around
  a plain Next.js `<Link>` (`navigation-menu-trigger.tsx:80-104`), which is the
  shadcn/ui-derived pattern the task description names -- and matches this documented
  recommendation's shape (an `asChild`-composed custom wrapper around the framework's own
  `Link`), though the doc's own example composes `NavigationMenu.Link` specifically (the
  leaf link primitive), whereas this repo composes `NavigationMenu.Trigger` (the
  dropdown-opening primitive) the same way -- a variant application of the same documented
  pattern, not a literal copy of the doc's example.
- **On delay tuning** -- the docs state the `delayDuration`/`skipDelayDuration` defaults
  (`200`/`300`) as part of the `Root` API reference table but offer no prose guidance on
  when/why to change them, no recommended values for a "should the navbar avoid needing a
  click workaround at all" goal, and (per section 2c) do not yet document `activationMode`
  or `disableToggle` at all since those props are unreleased.
- No WAI-ARIA Authoring Practices Guide (APG) page is linked from the fetched docs page
  itself for `NavigationMenu` (the docs' own quoted text above is the extent of its ARIA
  discussion) -- so there is no first-party pointer to a broader WAI-ARIA menu/menubar
  interaction-pattern doc to cross-check against, beyond the explicit disclaimer that such
  a pattern does not apply here.

## 5. Options considered, tradeoffs (neutral -- no recommendation made)

**(a) Keep the current custom `MutationObserver` workaround as-is.**
- Already faithfully implements the community-sourced fix for the exact bug in the linked
  issue/comment (section 1), and that issue remains open upstream with no released fix
  (section 2), so there is no drop-in replacement to switch to today.
  Tradeoff: continues to own all the workaround's inherent fragility -- per the issue's
  own opening commenter (`andy-hook`), any hack keyed off `data-state`/DOM attributes
  "relies on understanding the implementation details (which may change in the future)."
  It also does not explain, let alone fix, the deferred `/arhiv` production bug described
  in the task background -- the `disable` window is keyed per-trigger-instance
  (`navigation-menu-trigger.tsx:33` -- `useState` is per component instance, and the
  `MutationObserver` in the `useEffect` at `:45-77` only observes `forwarded_ref.current`,
  i.e. this trigger's own DOM node), so a neighboring trigger's hover-open should not, on
  a plain read of this file alone, set another trigger's `disable` flag -- confirming or
  ruling out the stated "neighboring trigger" hypothesis would require separate live
  reproduction/instrumentation, which this source-only investigation cannot provide.

**(b) Replace it with whatever first-party Radix mechanism exists.**
- The closest fit, `activationMode="manual"` (section 2c), is real, already merged into
  the submodule's `main`, and would (per its own doc comment) remove the hover-open state
  entirely -- eliminating the race by construction rather than by suppressing its
  symptom. It also does not require a `MutationObserver`, `useForwardedRef`, or a manual
  1000ms timer at all.
  Tradeoff: it is unreleased (no published npm version includes it as of this research;
  section 2c), so adopting it today is not possible without either pinning a git/commit
  install of `@radix-ui/react-navigation-menu` directly from the submodule's `main` (an
  unusual, harder-to-maintain dependency arrangement) or waiting for a numbered release of
  unknown timing. It would also change the navbar's hover-opens-on-mouseover UX
  altogether (manual mode never opens on hover/focus, only on click) -- a real product/UX
  change beyond a bugfix, not a drop-in swap for the current behavior.

**(c) Drop the custom workaround entirely if the upstream bug is fixed in the pinned/current Radix version.**
- Not supported by this research: the upstream issue is still open (section 1), this
  repo's installed `1.2.17` (and the submodule's newer `1.2.20`) both predate the only
  relevant new mechanism found (section 2c), and Radix's pre-existing first-party
  click/hover refs (`wasClickCloseRef`/`hasPointerMoveOpenedRef`, section 2b) predate the
  GitHub issue itself and were evidently not considered sufficient by the issue's own
  reporters through 2025. There is no version of `@radix-ui/react-navigation-menu`
  available today, at any published version number, where dropping the workaround is
  known to be safe based on the evidence gathered here.

**(d) Other options surfaced by this research:**
- Abuse `delayDuration`/`skipDelayDuration` to suppress hover-open near-entirely (per the
  2025-08-26 community comment: `delayDuration={1_000_000} skipDelayDuration={0}`) --
  available in every released version today, unlike (b), but explicitly described by its
  own author as "simple, stupid" and it does not address the `hasContent=false`
  plain-link click-cancellation bug this task is ultimately about, since a trigger with no
  dropdown content never enters a hover-opened `data-state="open"` in the first place --
  section 2a's timers are scoped to triggers that do have content.
- Track upstream for `activationMode`/`disableToggle`'s eventual numbered release (it is
  merged on `main` but unpublished per section 2c) and revisit adopting it once installable,
  as a scheduled follow-up rather than an immediate change.
- Narrow investigation of the deferred `/arhiv` bug specifically: this file only confirms
  what the current code *does* (per-instance `disable` state, scoped to the observed
  trigger's own node) and what upstream primitives exist; it does not reproduce or further
  diagnose the reported bug, which the task background already flagged as unreproduced and
  out of scope for a source-only pass.
