# Tailwind v3→v4 upgrade audit: broken `/arhiv` centering + related fallout

Convention note: this repo's agent-facing notes live in `docs/agents/` (see `AGENTS.md` → "Domain docs"), so this file follows that existing convention rather than introducing a new one.

## Root cause (confirmed)

`src/lib/page-variants.ts:33` builds every page wrapper with the bare `container` utility:

```ts
export const page_variants = cva("container h-full w-full pb-6 pt-8", { ... });
```

In Tailwind v3, `container` centered itself and got default padding through `theme.container.center` / `theme.container.padding` config keys. **Tailwind v4 removed those config keys entirely** — `container` is now just `width: 100%` plus the `max-width` breakpoint steps, with no centering or padding baked in. This repo's `tailwind.config.ts` is fully deprecated (comment-only) and `src/styles/globals.css` has no `@utility container` override to restore the old behavior, so every unstyled `container` usage now sits flush left instead of centered — exactly the `/arhiv` symptom reported. Confirmed against the primary source:

> "In v3, the `container` utility had several configuration options like `center` and `padding` that no longer exist in v4." — [tailwindcss.com/docs/upgrade-guide § Container configuration](https://tailwindcss.com/docs/upgrade-guide#container-configuration)

The guide's prescribed fix is a CSS-level override using the new `@utility` directive:

```css
@utility container {
  margin-inline: auto;
  padding-inline: 2rem;
}
```

## Findings

### Container usages (grep found 5 files matching `container`; 2 are real Tailwind-class breakages, 2 are false positives, 1 is already fixed)

| File:line | Pattern | Status under v4 | Source |
|---|---|---|---|
| `src/lib/page-variants.ts:33` | `cva("container h-full w-full pb-6 pt-8", ...)` — the page-level wrapper used across the app (including `/arhiv`) | **Broken.** No `mx-auto`/padding; content sits flush left. This is the reported bug. | Upgrade guide § Container configuration |
| `src/components/shell/desktop-header.tsx:113` | `"container relative flex h-[182px] w-full items-end justify-between px-6 py-4 backdrop-blur-sm"` | **Broken.** Same issue — header content will also be flush left instead of centered under the site's max-width. | Same |
| `src/components/shell/footer.tsx:8` | `<div className="container mx-auto px-4">` | **Already correct** — someone already hand-added `mx-auto px-4` here, so the footer centers fine despite the v4 change. Good precedent for the fix pattern (or a sign this was patched ad hoc without addressing the root cause). | — |
| `src/components/ui/sheet.tsx:56` | `container?: Element` prop on `SheetContentProps` | **False positive** — this is a Radix Portal `container` prop (DOM node target), unrelated to the Tailwind `container` utility. | — |
| `src/app/novica/[published_url]/image-gallery.tsx:74` | `const container_ref = useRef<HTMLDivElement>(null)` | **False positive** — variable name only, no Tailwind class. | — |

**Fix for both real breakages:** add the `@utility container` override to `src/styles/globals.css` (restores old behavior globally, no JSX changes needed), *or* replace bare `container` with explicit `mx-auto max-w-* px-*` at each call site (matches what footer.tsx already does by hand). Given `page-variants.ts` also takes an explicit `max_width` variant (`max-w-[848px]` / `max-w-[1280px]`), the `@utility container` route is lower-risk since it fixes both files (and any future `container` usage) in one place without touching component code.

### Secondary: shadow/radius scale rename (silent visual shift, not a hard break)

The class names `shadow-sm`, `rounded-sm`, and `outline-none` all still exist in v4 and won't error — but they now point at different values than they did in v3, because v4 renamed the whole scale one step:

> `shadow-sm` → `shadow-xs`, `shadow` → `shadow-sm`; `rounded-sm` → `rounded-xs`, `rounded` → `rounded-sm` — [upgrade guide § Renamed utilities / Updated shadow, radius, and blur scales](https://tailwindcss.com/docs/upgrade-guide#renamed-utilities)

Concretely: every component in this repo that was written pre-migration using the literal string `shadow-sm` or `rounded-sm` is now rendering with the value that used to be plain `shadow` / `rounded` — i.e. **larger/more visible** shadows and corners than the original v3 design intended. This is pervasive (shadcn/ui boilerplate), found in at least: `src/components/ui/card.tsx:12`, `tabs.tsx:32`, `checkbox.tsx:16`, `dropdown-menu.tsx` (multiple), `context-menu.tsx` (multiple), `select.tsx:121`, `command.tsx:128`, `sheet.tsx:71`, `multi-select.tsx:300,320`, `src/app/uredi/[draft_id]/image-selector.tsx:207`, `src/components/shell/sponsors.tsx:46`. Not a functional bug, but worth a design pass since it's a silent, repo-wide shift — not something to fix reflexively without checking each spot visually.

### Secondary: `outline-none` accessibility regression

Nearly every interactive shadcn component (`button.tsx`, `input.tsx`, `select.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `tabs.tsx`, `switch.tsx`, `checkbox.tsx`, `toast.tsx`, etc. — ~20 files) uses `focus:outline-none`/`focus-visible:outline-none` paired with a `ring-2` for the visible focus style. In v3, `outline-none` didn't actually set `outline-style: none` — it kept an invisible outline so forced-colors-mode / high-contrast users still got a focus indicator. In v4, `outline-none` is now literal (`outline-style: none`), and the old "invisible but present" behavior was moved to a new `outline-hidden` class:

> "`outline-none` utility previously didn't actually set `outline-style: none`... To make this more clear we've renamed this utility to `outline-hidden`" — [upgrade guide § Renamed outline utility](https://tailwindcss.com/docs/upgrade-guide#renamed-outline-utility)

No visible regression for most users (the `ring-2` still shows), but forced-colors/Windows High Contrast users lose the focus indicator. Mechanical fix: `focus:outline-none` → `focus:outline-hidden` across the affected files.

### Checked and confirmed clean (no action needed)

- **`ring-2`/`ring-offset-2` usages** (button.tsx, input.tsx, textarea.tsx, select.tsx, etc.) all pair with an explicit `ring-ring`/`ring-offset-background` color token defined in `@theme`, so the v4 default-ring-color change (`blue-500`→`currentColor`) and default-width change (3px→1px) don't affect them — they never relied on the v3 defaults.
- **No `@layer utilities` custom class definitions** exist anywhere in `src/` (grep confirmed) — nothing needs migrating to the new `@utility` API. The one `@layer base { * { @apply border-border } ... }` block in `globals.css:67-130` is the shadcn v4-idiomatic pattern and is unaffected by the `@layer`→`@utility` change (that change only applies to `@layer utilities`, not `@layer base`).
- **No arbitrary-value CSS-variable syntax** (`[--foo]`) found anywhere in `src/` — nothing needs the `(--foo)` parenthesis migration.
- **No `space-x-*`/`space-y-*` usage relies on `hidden`-sibling exclusion** as far as grep-visible — 16 files use `space-x-`/`space-y-` (e.g. `footer.tsx:9`, `contact-form.tsx`, `table.tsx`) but none were observed conditionally rendering `hidden` siblings inside a `space-*` container. The v4 selector change (`:not([hidden]) ~ :not([hidden])` → `:not(:last-child)`) is a perf fix and is safe here, but flag it if any of these lists later gain conditionally-hidden children — the new selector doesn't special-case `hidden` elements.
- **`postcss.config.cjs`** already uses `"@tailwindcss/postcss": {}` (the v4 dedicated package), not the legacy `tailwindcss` PostCSS-plugin usage — correct per [upgrade guide § Using PostCSS](https://tailwindcss.com/docs/upgrade-guide#using-postcss).
- **No leftover `tailwindcss-animate` v3-era dependency** — `package.json` only lists `tw-animate-css` (the v4-compatible successor already imported in `globals.css:2`). Nothing to clean up here.
- **`@tailwindcss/typography` `^0.5.20`** (devDependency) is loaded via `@plugin "@tailwindcss/typography";` in `globals.css:3`, which is the correct v4 CSS-plugin syntax (typography ≥0.5.16 supports v4's `@plugin` mechanism) — no incompatibility found.
- **`next.config.mjs`** has no explicit `--turbopack` flag in `package.json` scripts and the upgrade guide has no Turbopack-specific caveats for `@tailwindcss/postcss` — current setup matches Tailwind's documented Next.js integration.

## Prioritized fix plan

1. **Fix the centering bug** (root cause). Add to `src/styles/globals.css` right after the `@import` lines:
   ```css
   @utility container {
     margin-inline: auto;
     padding-inline: 2rem;
   }
   ```
   This fixes `page-variants.ts:33` (all pages, including `/arhiv`) and `desktop-header.tsx:113` in one place, and makes `footer.tsx:8`'s manual `mx-auto px-4` redundant (can be simplified back to bare `container` afterward, optional cleanup).
   Source: [upgrade guide § Container configuration](https://tailwindcss.com/docs/upgrade-guide#container-configuration).

2. **Other confirmed breakages / regressions** (lower urgency, no visible crash):
   - Sweep `focus:outline-none` / `focus-visible:outline-none` → `outline-hidden` across the ~20 `src/components/ui/*.tsx` files for forced-colors accessibility. Source: [upgrade guide § Renamed outline utility](https://tailwindcss.com/docs/upgrade-guide#renamed-outline-utility).
   - Visually review the `shadow-sm`/`rounded-sm` components listed above — decide per-component whether the new (larger) rendered value is acceptable or should be pinned back with `shadow-xs`/`rounded-xs`. Source: [upgrade guide § Renamed utilities](https://tailwindcss.com/docs/upgrade-guide#renamed-utilities).

3. **Cleanup**: none found — dependencies and PostCSS config are already v4-correct (see "Checked and confirmed clean" above). No action needed.

4. **Optional v4-feature adoption** (only where it maps to existing repo code, not speculative):
   - `src/app/novica/[published_url]/image-gallery.tsx` currently branches its carousel layout on a JS `useBreakpoint("md", true)` hook (`@kodingdotninja/use-tailwind-breakpoint`), which requires a client-side `matchMedia` check and risks a hydration flash. Since this component wraps its own container (`container_ref`), it's a plausible candidate to move the `md` breakpoint decision into a native CSS `@container` query instead, removing the JS breakpoint dependency for this one case — worth a look if that flash is ever reported, not urgent.

## Sources

- Primary: [tailwindcss.com/docs/upgrade-guide](https://tailwindcss.com/docs/upgrade-guide) (fetched in full; all quotes above are verbatim from this page, current as of fetch date 2026-07-16).
- Primary: installed `tailwindcss` version confirmed via `node_modules/tailwindcss/package.json` → `4.3.2`.
- No GitHub changelog / release-notes fetch was needed — the upgrade guide's wording was sufficient and directly on-point for every finding above.
