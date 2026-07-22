# Bug: stale draft data (author + debug JSON) flashes on new-draft creation

No existing convention for bug-investigation notes was found under `docs/adr/` or
`docs/agents/` (those hold ADRs and agent-audit reports respectively), so this
note lives at `docs/bugs/` per the fallback instruction.

> **Note (post-#29):** `editor_store` has since been migrated from `zustand-x`
> to plain `zustand` (issue #29) and never actually carried `persist` or
> `extendActions` by the time of that migration — the code excerpts below
> (`createStore(...).extendActions(...)`, `persist: { enabled: true }`,
> `editor_store.set("reset")`) predate the file they describe and no longer
> match `editor-store.ts`. The **diagnosis in §1/§2 is still valid** (module-
> singleton store not scoped/reset per draft) and the **fix plan in §3 still
> applies** to the current plain-zustand store — only the literal code
> snippets are stale.

## 1. Root cause

`editor_store` (`src/components/editor/editor-store.ts:25-43`) is a **module-scope
singleton** Zustand store built with `zustand-x`'s `createStore(...)`:

```ts
export const editor_store = createStore<EditorStoreType>(initial_data, {
	name: "editor",
	persist: { enabled: true },
}).extendActions(...)
```

`createStore` (`node_modules/zustand-x/dist/index.mjs:34-62`) calls
`createStoreZustand(builder.stateCreator)` exactly once, at module import time.
It is not created per-component-instance, not scoped by route param, and not
reset by React's key-based remount mechanism.

The editor page *does* remount the `Editor` tree per draft
(`src/app/uredi/[draft_id]/page.tsx:134-137`, `key={article.id}`), but that only
resets React component state/effects — it has no effect on this external
module-level store, which is what both of the buggy UI pieces read from:

- Author multiselect: `src/app/uredi/[draft_id]/toolbar.tsx:16` —
  `const author_ids = useStoreValue(editor_store, "author_ids");` fed directly
  into `MultiSelect`'s `defaultValue` (toolbar.tsx:49), not derived from the
  `draft` prop passed into `Editor`.
- Debug JSON panel: `src/app/uredi/[draft_id]/editor.tsx:84-92` (`SettingsSummary`)
  dumps `editor_store.useStore()` — the entire store — verbatim into a `<pre>`.

The store is only synchronized to the *actual* current article inside
`EditorProvider`'s EditorJS `onReady` callback
(`src/components/editor/editor-context.tsx:75-109`):

```ts
onReady: () => {
	setTimeout(() => { ... Undo/DragDrop init ... }, 500);
	setTimeout(() => { forceUpdate(); }, 1000);
	async function update_article() {
		editor_store.set("reset");
		const editor_content = await editorJS.current?.save();
		...
		update_settings_from_editor({ ...article-derived fields... });
	}
	void update_article();
}
```

This only fires once EditorJS itself finishes initializing (async, no
guaranteed timing — note the hand-rolled 500ms/1000ms `setTimeout`s nearby for
other init steps). Between the new page's first paint and this callback
firing, `MyToolbar` and `SettingsSummary` render whatever was already sitting in
the global `editor_store` — i.e., the previous draft's `author_ids`/`title`/etc.
This is exactly the "flash of Damijan Šinigoj, then it clears" behavior.

## 2. Why the debug JSON showed a *different* draft (`2ef6c12b…`), not the one just visited (`c1451d57…`)

`editor_store` is additionally configured with `persist: { enabled: true }`
(`editor-store.ts:27-29`), which zustand-x wires through `zustand/middleware`'s
`persist` (`node_modules/zustand-x/dist/chunk-LOQBMPXN.mjs:37-38,158-163`) using
the store's `name` ("editor") as the storage key — defaulting to `localStorage`.
That means this state isn't just "leftover from the last in-memory navigation
in this tab" — it's whatever the *last write anywhere* (any past session, any
tab) put in `localStorage["editor"]`.

So the sequence that produced the mismatched id is consistent with: at some
earlier point the user (or another tab) had the editor open on the
`2ef6c12b-…` draft row for "Madžarski obisk Čaganke" and its `onReady →
update_article()` wrote that draft's `draft_id`/`title`/`author_ids` into
`editor_store`, which got flushed to `localStorage`. That row may since have
been superseded — `CreateSupersedingDraftButton`
(`src/components/article/create-superseding-draft-button.tsx:29-47`) spawns a
**new** draft row with a **new** id (`create_superseding_draft` →
`router.push(get_draft_article_link(draft.id))`) whenever you edit a
published/archived article, which is exactly how a second id for the same
title can exist. The homepage's "latest draft" entry the user clicked
(`c1451d57-…`) is a different, newer row for the same article title, but the
stale localStorage payload from the older `2ef6c12b-…` row was never cleared
and simply outlived it — it has nothing to do with the current navigation's
URL, which is why the id in the debug panel doesn't match the id in the
address bar. Reloading re-runs the whole mount → EditorJS → `onReady` →
`update_article()` sequence fresh and (by the time the user looks) has already
overwritten the store with the truly-current article's data, so the
inconsistency isn't visible after reload — the race is still there, it's just
consistently won by then.

## 3. Fix plan (not implemented — research only)

- Stop treating `editor_store` as a global singleton scoped to the whole app:
  create/reset it per draft instance (e.g. build it inside `EditorProvider` via
  `useState(() => createStore(...))`, or at minimum `editor_store.set("reset")`
  synchronously keyed on `draft.id` before first paint) instead of relying on
  EditorJS's async `onReady`.
- Initialize `author_ids`/`title`/`url`/`draft_id`/etc. directly from the
  `draft` prop (already available synchronously in `Editor`/`EditorProvider`)
  rather than waiting for `update_settings_from_editor` to run inside
  `onReady` — the EditorJS round-trip should only need to supply
  content-derived fields (heading/url from body), not identity fields already
  known up front.
- Drop `persist: { enabled: true }` on `editor_store`, or scope its storage key
  to the draft id (e.g. `name: \`editor-${draft.id}\``) so state from one
  draft/session can never leak into an unrelated one via `localStorage`.
- Add a guard in `MyToolbar`/`SettingsSummary` (or in the store itself) so
  stale state whose `draft_id` doesn't match the currently-rendered
  `article.id` is never rendered — even as a stopgap before the above is done.

## 4. Other things noticed nearby (short, high-confidence only)

- `SettingsSummary` (`src/app/uredi/[draft_id]/editor.tsx:84-92`) unconditionally
  renders the raw internal store as a `<pre>` debug JSON block in what appears
  to be production UI, not gated behind a dev-only flag.
- `EditorProvider`'s `onReady` handler relies on bare `setTimeout(..., 500)` /
  `setTimeout(..., 1000)` (`editor-context.tsx:76-85`) to sequence
  `Undo`/`DragDrop` plugin setup and a `forceUpdate()` — timing-based, not
  event-based; can easily race under slow devices/networks the same way the
  main bug does.
- Because `editor_store` is one shared module singleton, two tabs each editing
  a different draft simultaneously will fight over the same in-memory (and
  persisted) state — every `editor_store.set(...)` in one tab is invisible to
  the other tab's React subscriptions but both read/write the same
  `localStorage["editor"]` key, so whichever tab writes last on unload/save
  wins, silently clobbering the other.
