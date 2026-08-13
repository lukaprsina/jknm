# TanStack Form migration and Next.js URL query-param state

**Status: partially actioned.** #31 explicitly deferred the TanStack Form question
("not required here" — out of scope). The 3 URL-state migrations this doc recommends
(`preveri-client.tsx`, `/arhiv` search, `/avtorji` table → shallow routing) have not been
confirmed shipped; treat as an open backlog item, not settled history.

Two independent questions bundled together because both surfaced from the same
prompt: (1) is it worth moving this repo's forms off `react-hook-form` onto
`@tanstack/react-form` (vendored at `vendor/tanstack-form`), and (2) what is
the *current* (Next 16) primary-source-documented way to drive UI state from
URL query params, given the user's own observation that "things have changed
since Next 13."

Sources: this repo's `src/`, the vendored `vendor/tanstack-form` submodule
(docs + philosophy, cited by path), and the Next.js docs **bundled with the
installed `next@16.2.10`** at `node_modules/next/dist/docs/` — the same
primary-source policy the prior `docs/research/nextjs16-caching*.md` docs
used, and the one the `mcp__next-devtools__nextjs_docs` tool itself points at
for this exact, installed version (it resolved to
`docsPath: "node_modules/next/dist/docs/"`, `versionSource: "installed"`,
confirming there's no separate "web docs" path to fall back to for a
version-accurate answer — the bundled copy *is* the primary source for this
question). No blog posts, no training-data recall of Next 13-era APIs.

---

## Existing Forms Inventory

`react-hook-form@^7.81.0` and `zod@^4.4.3` are both direct dependencies
(`package.json:127,149`); there is no `@hookform/resolvers` package listed,
but `zodResolver` is imported from `@hookform/resolvers/zod` in every form
below, so it must be a transitive/undeclared dependency — worth a `pnpm why`
check, out of scope here. A single shared shadcn-style `Form`/`FormField`
wrapper lives at `src/components/ui/form.tsx`, built directly on
`react-hook-form`'s `Controller`/`FormProvider`/`useFormContext`
(`src/components/ui/form.tsx:6-13`); every RHF form in the app goes through
it.

Grepping `src/` for `useForm(`, `react-hook-form`, `zodResolver`, and `<form`
turns up exactly five files that build a form (raw or RHF), plus one that
does per-row inline UI state without a `<form>` at all:

| File | Purpose | Fields / complexity | Validation | Submission |
|---|---|---|---|---|
| `src/app/uredi/[draft_id]/settings-form.tsx` | Admin article editor: publish-date + thumbnail-crop dialog, plus delete/discard actions in the same panel | 2 fields (`created_at: z.date()`, `thumbnail_crop` optional), no arrays, one dependent bit of UI (delete label swaps between "Izbriši novičko" / "Izbriši objavljeno novičko" based on `useIsSupersedingDraft()`, not a form field) | `zodResolver(form_schema)` | Two different submit paths off the same `form.handleSubmit(...)` — "Shrani kot osnutek" calls `editor_mutations.save_draft(...)`, "Objavi spremembe" calls `editor_mutations.publish(...)`; both are oRPC-backed mutation wrappers (`useEditorMutations`) |
| `src/app/avtorji/table-forms.tsx` | Admin authors table: rename a guest author (`EditAuthorNameForm`) and insert a new guest author (`InsertAuthorForm`), each opened from a dialog | 1 field each (`name: z.string().min(1).max(255)`) | `zodResolver` on both | `useMutation` (`@tanstack/react-query`) wrapping `unwrap_server_function(renameGuest(...))` / `insertGuest(...)` — oRPC procedures — then `router.refresh()` |
| `src/app/kontakt/contact-form.tsx` | Public contact form | 4 fields (`email`, `name`, `address?`, `message`), no arrays/dependent fields | `zodResolver(contact_form_schema)` — schema itself is unrefined (`z.string()` with no `.email()`/`.min()`, i.e. validation is present in shape but not meaningfully strict) | Plain `fetch("/api/send", …)` — **not** an oRPC mutation, the one form in the app that still talks to a raw API route |
| `src/components/date-time-picker/form.tsx` | `DateTimePickerForm` — looks like a demo/showcase component (shadcn "date time picker" example), not obviously wired into a real page | 1 field (`dateTime` optional) | `zodResolver(formSchema)` | `onSubmit` just fires a toast with `JSON.stringify(data)` — no real backend call |
| `src/app/preveri\preveri-client.tsx` | Admin "preveri" (verify) tool: jump to a legacy article by numeric ID, prev/next paging through an array of legacy IDs | 1 raw `<input type="number">`, no schema | None — `parseInt` + `Number.isNaN` guards | Raw `<form onSubmit>` with `event.preventDefault()`; no RHF, no zod, no backend mutation. State (`inputPage`, current index) is **not** wired through RHF *or* the URL — it's a mix of local `useState` and a `zustand` store persisted to `localStorage` (`preveri_store`, `create<PreveriStoreType>()(persist(...))`) |
| `src/app/prijava/signin.tsx` | Sign-in page | 0 form fields — it's a single Google OAuth button (`sign_in_with_google`) and a sign-out button, no `<form>` element at all | n/a | n/a |

Two more `<form>`/`useState` hits from the initial grep that are **not** forms
in the RHF/zod sense, listed for completeness since the task asked to record
"raw forms" too:

- `src/app/avtorji/table.tsx` — TanStack Table `sorting`/`rowSelection`/`pagination` state (`useState`, lines 42-44), admin authors table. No `<form>`; this is filter/sort/paginate UI state, covered in the URL-state section below, not a form.
- `src/app/arhiv/components.tsx` — Algolia `react-instantsearch` hooks (`useSearchBox`, `useRefinementList`, `useSortBy`), archive page search/filter/sort. Also not a form; also a URL-state candidate below.

**Total form surface in the app: five real forms, one of which (the date-time
picker demo) may not even be reachable from a page.** All five real forms are
low field-count (1–4 fields), flat (no nested objects), and have **zero
array/dynamic fields** anywhere in the codebase — `grep -rn "mode=\"array\"\|useFieldArray"` across `src/` returns nothing. Nothing has dependent/conditional
field logic either (the closest is `settings-form.tsx`'s delete-button label,
which is derived from context, not from another form field).

---

## TanStack Form Findings

All claims below are cited to files inside `vendor/tanstack-form`, the
submodule AGENTS.md names as the primary source for this library
(`AGENTS.md:15-24`).

### Core API shape

`useForm` + `form.Field` (render-props) is the baseline API; `createFormHook`
/ `useAppForm` is an optional second layer for pre-binding reusable field/form
components ("Avoid hasty abstractions. Render props are great!" is the
comment left directly in the quick-start example) —
`vendor/tanstack-form/docs/framework/react/quick-start.md:12-134`. The
library's own philosophy doc is explicit that it deliberately avoids
generics/type params in favor of full inference from `defaultValues`
(`vendor/tanstack-form/docs/philosophy.md:40-65`), and commits to **controlled**
inputs everywhere, arguing this is "predictable," "easier testing," and
better for "enhanced conditional logic" (`philosophy.md:28-38`) — relevant
here because RHF's headline pitch is *un*controlled-by-default for
performance, so this is a real philosophical divergence, not just API sugar.

### Validation / Zod

Zod (and Valibot/ArkType/Effect-Schema) work out of the box because TanStack
Form consumes the **Standard Schema** spec directly —
`vendor/tanstack-form/docs/framework/react/guides/validation.md:468-477`. You
pass the schema straight into `validators: { onChange: userSchema }` at the
field or whole-form level with no adapter package
(`validation.md:483-508`) — **there is no TanStack-Form equivalent of
`@hookform/resolvers/zod`**; the resolver-package layer RHF needs simply
doesn't exist in this API. One caveat worth flagging for this repo's zod v4
usage: `validation.md:479` notes *"Validation will not provide you with
transformed values"* — i.e. schema `.transform()`s don't flow through the
way `zodResolver` output does in RHF, which none of this repo's five schemas
currently rely on (they're all flat, untransformed shapes), so it's a
non-issue today but worth remembering if a future form schema does a
transform.

### Arrays

`field.state.value` + `mode="array"` + `field.pushValue(...)`, with per-item
subfields addressed by string path (`` `people[${i}].name` ``) —
`vendor/tanstack-form/docs/framework/react/guides/arrays.md:10-53`. This is
the one area where TanStack Form's own comparison table claims an edge:
*"For nested arrays, react-hook-form requires you to cast the field array by
its name if you're using TypeScript"* — `vendor/tanstack-form/docs/comparison.md:33`,
footnote (1) on the "Nested object/array fields" row (`comparison.md:25`).
**This repo has no array fields in any form** (verified above), so this
advantage doesn't currently apply.

### SSR / Next.js integration

`vendor/tanstack-form/docs/framework/react/guides/ssr.md:176-331` documents a
Next.js App Router integration, but it is built entirely around **Next.js
Server Actions**: a `formOptions` object shared between client and server
(imported from the framework-specific `@tanstack/react-form-nextjs` package),
a `'use server'` action calling `createServerValidate`, and the client using
React's `useActionState` plus TanStack's `useTransform`/`mergeForm` to splice
server-returned validation state back into the client form
(`ssr.md:192-319`). **This repo has already rejected Server Actions as its
transport** — ADR-0002 (cited via `docs/research/nextjs16-caching-verdict.md:96-102`,
which quotes it directly) chose oRPC specifically to avoid Next-locking the
mutation layer. That means the one meta-framework integration TanStack Form
documents for Next.js doesn't map onto how this app actually submits forms
(oRPC mutations via `@tanstack/react-query`, per every real form in the
inventory above) — adopting TanStack Form here would mean **using it in its
plain client-only `useForm`/`form.handleSubmit()` mode** (as shown in
`overview.md:34-157` and `quick-start.md:89-134`), not the documented Next.js
SSR path, since that path is Server-Actions-shaped and this app's mutations
aren't.

### Comparison table's other claims

`vendor/tanstack-form/docs/comparison.md:15-31` (self-reported, flagged
"under construction" at the top of the file) claims TanStack Form beats RHF
on: framework-agnosticism (RHF is React-only, ✅ vs 🛑), "Granular
reactivity" (❓ for RHF, meaning even TanStack's own table doesn't assert an
RHF deficiency there), and SSR integrations (✅ vs 🛑 for RHF) — though per
above, the "✅" for Next.js specifically assumes Server Actions. React
Compiler support is listed 🛑 for RHF vs ✅ for TanStack Form
(`comparison.md:31`); this repo's `package.json` was not checked for a React
Compiler flag as part of this research and that claim wasn't independently verified.

---

## TanStack Form Recommendation (per-form verdict)

| Form | Verdict | Why |
|---|---|---|
| `settings-form.tsx` (editor publish/thumbnail) | **Stay on react-hook-form** | 2 flat fields, one already-working `zodResolver`, two submit paths already wired to oRPC mutations. Nothing here — no arrays, no dependent fields — plays to TanStack Form's stated strengths. Migrating buys a philosophy change (controlled inputs) the app doesn't need and costs a rewrite of the shared `~/components/ui/form.tsx` wrapper (or a parallel one), since that wrapper is RHF-`Controller`-specific (`src/components/ui/form.tsx:6-13`). |
| `table-forms.tsx` (rename/insert guest author) | **Stay on react-hook-form** | Single-field forms. This is the least-complex end of the spectrum in the whole inventory; neither library's differentiators (array fields, granular reactivity, framework-agnosticism) are in play. |
| `contact-form.tsx` | **Too trivial to need either, but don't touch it** | 4 flat fields, a schema that isn't even meaningfully strict today (no `.email()`/`.min()` — see inventory). If this form is ever revisited, tightening the zod schema is higher-value than a library swap. |
| `date-time-picker/form.tsx` | **Delete, or leave alone — not a migration target** | Appears to be an unused shadcn showcase snippet (`onSubmit` just toasts `JSON.stringify`); worth confirming it's actually rendered anywhere before spending any migration effort on it either way. |
| `preveri-client.tsx` (raw form) | **Not a form-library candidate at all** | It's one raw numeric `<input>` with a preventDefault handler — adding RHF or TanStack Form here would be pure overhead. The real improvement available for this file is moving its state to the URL (see below), not a validation library. |

**Overall TanStack Form verdict: do not migrate.** Every real form in this
codebase is small, flat, and already working. The two areas where TanStack
Form's own documentation and comparison table claim a real edge over RHF —
array-field ergonomics and a documented Next.js SSR integration — don't apply
here: there are no array fields anywhere in the app, and the documented
Next.js integration is Server-Actions-shaped while this repo deliberately
routes all mutations through oRPC (ADR-0002). Migrating would mean rewriting
the shared `ui/form.tsx` wrapper and touching five working call sites for a
philosophical/DX preference (controlled-by-default, schema-passed-directly)
with no concrete bug or missing capability driving it. Per `CONTEXT.md`,
single maintainer, actively iterating — this is exactly the kind of "rewrite
without a forcing function" the prior caching-verdict doc argued against for
a different library, and the same reasoning holds.

---

## Next.js URL Query Param State (current APIs)

Confirmed via `mcp__next-devtools__nextjs_docs` (queried with topic
`"useSearchParams usePathname useRouter shallow routing query params App
Router"`), which returned `{"status":"use_bundled_docs", "nextVersion":
"16.2.10", "versionSource":"installed", "docsPath":"node_modules/next/dist/docs/"}`
— i.e. for this installed version, the tool's own answer is "read the bundled
docs," which is what the citations below do. The MCP tool did not fail; it
resolved to a docs *path* rather than serving content inline, which is
consistent with how the prior `docs/research/nextjs16-caching*.md` docs used
this same bundled-docs source.

### The three read hooks (Client Components only)

- **`useSearchParams()`** — read-only `URLSearchParams` view of the current
  query string (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md:6-8`).
  Introduced in `v13.0.0` per that file's own Version History table (line 382)
  — this part hasn't changed since Next 13.
- **`usePathname()`** and **`useRouter()`** — same vintage; `useRouter`'s
  "Migrating from `next/router`" section documents that the Pages-Router
  `router.query` object "has been removed and is replaced by
  `useSearchParams()`" (`.../use-router.md:58-63`) — i.e. the `router.query`
  API some Next-13-era memory might reach for is Pages Router only and does
  not exist in App Router.

### What *has* changed since Next 13: the `searchParams` page prop is now async

The Server Component `Page` prop `searchParams` was a synchronous object
through Next 14. **Next 15.0.0-RC changed it to a `Promise`**, per the exact
Version History row in the bundled docs: *"`params` and `searchParams` are
now promises. A codemod is available"*
(`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md:239`).
Current usage (Next 16, same as 15):

```tsx
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { page = '1', sort = 'asc', query = '' } = await searchParams
  // ...
}
```
(`.../page.md:169-185`, the doc's own "Handling filtering with `searchParams`"
example — filtering/pagination/sorting is the literal use case the docs name
for this prop.) In a Client Component page, the same promise is unwrapped
with React's `use()` instead of `await` (`page.md:203-209`). Layouts still
**do not** receive `searchParams` at all, by design — a shared layout isn't
re-rendered on navigation, so it would go stale
(`page.md`'s cross-reference at `use-search-params.md:270-274`).

### The actual "since Next 13" behavior change relevant to shallow query updates

This is the part the user specifically flagged and is the most
decision-relevant finding: Next's own **"How to build single-page
applications"** guide documents a **"Shallow routing on the client"** pattern
that bypasses the Next.js Router/RSC round trip entirely, using the **native**
`window.history.pushState` / `window.history.replaceState`:

> "Next.js allows you to use the native `window.history.pushState` and
> `window.history.replaceState` methods to update the browser's history stack
> without reloading the page. `pushState` and `replaceState` calls integrate
> into the Next.js Router, allowing you to sync with `usePathname` and
> `useSearchParams`."
> (`node_modules/next/dist/docs/01-app/02-guides/single-page-applications.md:298-302`)

with the worked example:

```tsx
'use client'
import { useSearchParams } from 'next/navigation'

export default function SortProducts() {
  const searchParams = useSearchParams()
  function updateSorting(sortOrder: string) {
    const urlSearchParams = new URLSearchParams(searchParams.toString())
    urlSearchParams.set('sort', sortOrder)
    window.history.pushState(null, '', `?${urlSearchParams.toString()}`)
  }
  return (/* buttons calling updateSorting */)
}
```
(`single-page-applications.md:304-325`)

This is distinct from, and a genuine *addition* on top of, the Next-13-era
pattern of building a query string and calling `router.push`/`router.replace`
or a `<Link href={{ pathname, query }}>` — that pattern still works and is
still documented as the "Updating `searchParams`" example in the
`useSearchParams` reference page itself
(`use-search-params.md:278-328`, using a `createQueryString` helper +
`router.push(pathname + '?' + createQueryString(...))`), but `router.push`
performs a **Next.js client-side navigation** — it re-renders the Server
Component tree for the new `searchParams` (that's precisely why the async
`searchParams` prop and its Client-Component `use()` counterpart exist, and
why the docs pair every `useSearchParams` example with a `<Suspense>`
boundary warning about "Missing Suspense boundary with useSearchParams" build
failures, `use-search-params.md:176-182`). The `window.history.pushState`
path, by contrast, updates the URL bar and is observable via
`usePathname`/`useSearchParams` **without** invoking that navigation/RSC
machinery — it is the closest thing in current Next.js docs to "update a
query param with no server round trip." `<Link>` also supports the object
form `href={{ pathname: '/about', query: { name: 'test' } }}`
(`node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md:92-107`)
for the normal (navigating) case.

Also newer since Next 13: `router.push`/`router.replace` gained a `scroll`
option (`scroll: false` to suppress the default scroll-to-top-on-navigate
behavior — `use-router.md:117-138`, `link.md:230-236`), and `useRouter`'s
`prefetch()` gained an `onInvalidate` callback in `v15.4.0`
(`use-router.md:163`). Neither changes the shallow-routing story above but
both are relevant if any URL-synced UI also needs to control scroll
restoration.

### Summary of current (Next 16) primary APIs

| Need | Mechanism | Doc citation |
|---|---|---|
| Read query params in a Client Component | `useSearchParams()` | `use-search-params.md:6-8` |
| Read query params in a Server Component Page | `searchParams` prop (now a `Promise`, `await`/`use()` it) | `page.md:169-185,203-209`, version row at `page.md:239` |
| Read pathname in a Client Component | `usePathname()` | `use-router.md:71-92` (used alongside `useSearchParams`) |
| Navigate + set params (full round trip, re-renders Server Components) | `router.push`/`router.replace` with a built query string, or `<Link href={{ pathname, query }}>` | `use-search-params.md:278-328`, `link.md:92-126` |
| Update params **without a server round trip** | `window.history.pushState`/`replaceState`, which Next's router still keeps in sync with `usePathname`/`useSearchParams` | `single-page-applications.md:296-325` |

---

## URL State Recommendation

Cross-referencing Part 1's inventory (including the two non-form UI-state
files) against the mechanisms above:

- **`src/app/preveri/preveri-client.tsx`** — strongest candidate in the repo.
  `preveri_store` (zustand + `persist` to `localStorage`) tracks which legacy
  article ID the admin is currently paging through
  (`preveri-client.tsx:24-26`), and the raw `<input type="number">` is local
  `useState`. Both should be query params (e.g. `?id=123`) via
  `useSearchParams()` read + `router.replace(pathname + '?id=' + n, { scroll:
  false })` (or the shallow `window.history.replaceState` variant, since a
  server round trip buys nothing here — the page doesn't read `id` server-side
  today). This turns "which legacy article was I checking" into something
  shareable/bookmarkable/back-button-able, which `localStorage` cannot do
  (it's per-browser, and doesn't survive a link being shared to file an
  issue about a specific legacy article).
- **`src/app/arhiv/components.tsx`** — Algolia `react-instantsearch` search
  box, sort-by, and year `useRefinementList` are all local component state
  today (`useState` for the search input, InstantSearch's own internal
  connector state for refinements/sort — none of it touches the URL). This is
  precisely the "filtering, pagination, or sorting" case the bundled docs
  name for `searchParams` (`page.md:165-167`). `react-instantsearch` ships its
  own `history` routing addon designed for exactly this (not covered by these
  docs, but worth a follow-up look since it's the more idiomatic fix inside
  Algolia's own ecosystem than hand-rolling `useSearchParams` sync); at
  minimum, the current sort/search/year-filter state should become
  shareable via query params using the shallow `window.history.pushState`
  pattern, since re-fetching from the server on every keystroke of a search
  box would be wasteful and Algolia is already a client-side search index.
- **`src/app/avtorji/table.tsx`** — TanStack Table `sorting`/`pagination`
  state (`useState`, lines 42-44). Lower priority: it's an admin-only table,
  and per `CONTEXT.md` "the pain is entirely on the admin/editing side" but
  this specific page isn't flagged as a pain point anywhere in the existing
  research docs. Still a reasonable shallow-routing candidate if the admin
  ever wants to link a teammate to "page 3, sorted by name."
- **The five real forms** — none of them are URL-state candidates. Form
  input (a person's name, a contact message, a publish date) isn't the kind
  of state a user benefits from having bookmarkable or shareable in a URL;
  syncing form fields to query params would be over-engineering for input
  data that's either transient (typed once and submitted) or already backed
  by a real record (the draft article itself, addressed by `draft_id` in the
  route already).
- **Sign-in (`prijava/signin.tsx`)** — no query-param-worthy state; it's a
  single OAuth button.

For all of the above, the mechanism should be `window.history.pushState`/
`replaceState` (the shallow-routing pattern,
`single-page-applications.md:296-325`) rather than `router.push`, specifically
*because* none of these pages currently read `searchParams` server-side to
render anything — introducing `router.push` would newly force a Next.js
client-side navigation (and the associated `<Suspense>`-boundary requirements
for `useSearchParams`, `use-search-params.md:176-182`) to update state that's
purely client-side today. If a future need arises to make one of these
filters *server-rendered* (e.g. SEO for a filtered archive view), that's the
point to switch that specific route to the `searchParams` Page prop
(`page.md:169-185`) instead.

---

## Overall verdict

Neither half of this research turned up a forcing function. The forms in
this codebase are small, flat, and already work on `react-hook-form` +
`zodResolver`; TanStack Form's genuinely documented advantages (array-field
ergonomics, a from-scratch Next.js SSR story) don't land here because there
are no array fields and this app's mutation layer already deliberately
bypasses the Server-Actions path TanStack Form's Next.js guide assumes — so
**stay on react-hook-form** for all five forms, and don't bother swapping the
one likely-dead demo component either way. The URL-state side is more
actionable: three places in the app (`preveri-client.tsx`'s legacy-ID pager,
`arhiv`'s Algolia search/sort/filter state, and `avtorji`'s table
sort/pagination) currently hold shareable-by-nature state in `localStorage`
or component `useState` where Next 16's shallow-routing pattern
(`window.history.pushState`/`replaceState` kept in sync with
`usePathname`/`useSearchParams`) would make it bookmarkable and back-button-
friendly at effectively no cost — that's real, scoped, low-risk work,
independent of and unrelated to the forms question.
