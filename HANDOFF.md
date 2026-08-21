# Handoff — Evergreen-page link audit (Zgodovina jumbled links)

Session date: 2026-08-21. Repo: `d:\dev\js\jknm` (branch `main`). Saved at repo
root (not temp) per explicit user request this session.

## What this session actually did, in order

1. Fixed the 3 remaining `scripts/audit-evergreen-pages.ts` findings from a
   prior session: Varstvo's 21 `jknm-si.vercel.app` preview-domain links
   (`scripts/fix-evergreen-links.ts`, rewritten to relative `/novica/<slug>`),
   Zgodovina's 1 `vsebina.jknm.org` PDF (same script, freshly ingested onto
   `gradivo.jknm.org` via `ingest_media_from_url` — new Media row
   `bb2ee472-3730-41b9-a71f-52e02abf3527`), and 4 `old_domain_link` findings
   in Klub/Zgodovina (`scripts/fix-evergreen-old-domain-links.ts`, rewritten to
   relative `/`, `/klub#eticni-kodeks`, `/klub#drustvo-v-javnem-interesu` —
   anchor targets verified against the live `/klub` page's actual `id`
   attributes, not guessed). Both scripts executed with `--execute`, both left
   in `scripts/` (not yet moved to `scripts/retired/repairs/` — ask user).
   Re-ran `audit-evergreen-pages.ts` after: confirmed 0 findings except 1
   intentional `old_domain_link` (a historical text-only mention of
   `http://www.jknm.si` describing the site's 2008 launch — href rewritten to
   `/`, text left as the literal historical string on purpose).
2. `.gitignore` audited and fixed: added `/artifacts/evergreen-page-audit/`
   and `/artifacts/evergreen-links/` (generated audit output, same category as
   the existing `discrepancies/`/`link-diff/`/`media-hash-diff/` entries).
   Unstaged an accidentally-`git add`-ed generated file
   (`artifacts/evergreen-page-audit/old_domain_link.json`) that had slipped
   into the index. Deleted a user-created scratch file (`klub-main.html`, a
   devtools HTML dump used to find `/klub`'s real anchor IDs).
3. **The actual point of this session**: user asked to verify the rewritten
   hyperlinks are *functionally correct*, not just correctly shaped. While
   spot-checking Zgodovina by hand, user found 3 links in one paragraph
   (about "Cvingerska jama") that clearly point to unrelated articles — asked
   for a proper audit of whether other evergreen-page links are similarly
   jumbled.
4. Wrote `scripts/audit-evergreen-link-targets.ts` (new, permanent, left in
   `scripts/`): for every `/novica/<slug>` link on the 5 evergreen
   `article_kind: "content"` pages, resolves the target article via
   `ArticleSlug` and pairs the *surrounding sentence* (from the evergreen
   page's own `content_json`) with the target's actual title/`published_at`/
   opening excerpt, dumped to `artifacts/evergreen-link-context/<page>.json`
   (gitignored — same category as `evergreen-links/`, not yet added to
   `.gitignore` — **do this next session** if the script survives).
   **Non-obvious bug hit and fixed while writing it**: the first version only
   read `data.text` from blocks, silently missing every link inside a `list`
   block (`data.items[].content`, recursively nested via `items`) — editorjs's
   list tool stores item text there, not in `data.text`. This is why Zgodovina
   first reported 30 links, then 57 once list blocks were included — the
   missing links were exactly the ones inside Zgodovina's long chronological
   bullet-point sections. Also had to `decode()` HTML entities in hrefs (one
   href had `&amp;l=2019` baked in from the original markdown source, breaking
   slug lookup) and filter to `status: "published"` only (there are multiple
   rows per evergreen title — drafts/supersedes — and an unfiltered query was
   silently overwriting the output file once per row, producing inconsistent
   link counts across runs until this was caught).
5. Read through the script's output by hand (context is Slovene, semantic
   judgment needed, not automatable). Findings:
   - **Raziskovanje** (3 links) and **Varstvo** (21 links) look clean —
     Varstvo has no narrative context to cross-check against (it's a bare
     "see also" list, not prose), but titles are all topically plausible.
   - **Zgodovina is badly jumbled**: of 57 `/novica` links, roughly half point
     to an article unrelated to what the surrounding sentence describes.
     Confirmed well beyond the user's original 3-link spot: see conversation
     transcript for the ~15+ concrete mismatches identified (Cvingerska jama
     paragraph, Brezno v Debliških livadah cleanup list, 55th/60th anniversary
     mentions, etc.) — **not yet compiled into a clean deliverable file**, only
     narrated in chat.
6. User then asked to check whether this bug predates the DB migration, by
   pulling the pre-migration MDX source out of git history. Git story
   established:
   - Original filename was `page.mdx`, hand-authored starting 2024-09-24
     (`fe47777`/`95e082e`/`6d455b3`), Zgodovina finished later at `8d70730`.
   - Renamed `page.mdx` → `content.mdx` in `25405b4` ("Rewrite table of
     contents (#30)", 2026-07-20).
   - Deleted in `61aa0a6` ("Cut over the old MDX static-page system...",
     2026-08-11) once the DB-backed version replaced it. **Last-good MDX
     state is `61aa0a6`'s parent, `ed62516`.**
   - Extracted all 5 `content.mdx` files from `ed62516` into a scratch dir
     (`artifacts/mdx-snapshot/`, since deleted — was throwaway), grepped
     Zgodovina directly. **Every mismatch already existed in the original
     hand-authored markdown** — e.g. `[fotodokumentirali](/novica/dolenjski-jamarski-tabor-2016)`
     on the Cvingerska jama sentence was already wrong in the raw `.mdx`
     source. This is conclusive: the jumbling is **not** a migration
     artifact (not from the DB cutover, not from `editorjs` conversion, not
     from any fix script run this or prior sessions) — it's a pre-existing
     content-authoring bug, most likely from copy-pasting anchor `href`s
     across adjacent bullet points during original writing and not updating
     the target each time.
7. User mentioned two other potential sources of truth, not yet consulted:
   - The original Word doc is on the **admin's own computer**, not in this
     repo or its git history — inaccessible to me directly.
   - DB backups exist at `D:\Luka\JKNM\*.dump` (Postgres dump format,
     presumably from `pg_dump`) — **not yet opened or considered this
     session**. Given the MDX-source check already proved the bug predates
     any DB state, these dumps likely won't contain a "correct" version
     either (the links were never derived from the DB — they were hand-typed
     during MDX authoring), but worth a quick sanity check if the user wants
     extra certainty, or if a *specific* link's history is in question (e.g.
     if it was ever manually corrected in the DB after the MDX was retired,
     which wouldn't show up in git).

## Current state / immediate next step

Session was mid-"here's what I'd like to do next" when compaction was
triggered. My last message ended with an offer: **compile the full list of
~25-30 flagged Zgodovina mismatches (sentence + current wrong target +
best-guess correct target) into a clean reviewable format** — this has not
been done yet, only individual examples were narrated in chat. This is the
natural next step: re-run `bun run scripts/audit-evergreen-link-targets.ts`
(output already exists at `artifacts/evergreen-link-context/zgodovina.json`
unless cleaned up), go through all 57 entries systematically (not just the
subset already eyeballed), and for each mismatch, search the target's real
subject via `/arhiv` (or query articles by title keyword) to propose a
correct replacement — then get user sign-off before writing any fix script.

**No content has been changed for the Zgodovina jumbled-link bug yet** — this
whole investigation was read-only (audit script + git archaeology). The 3
earlier fixes (Varstvo preview-domain links, Zgodovina PDF, 4 old-domain
links) are already applied to the DB from before this bug was discovered.

## Key facts/conventions worth knowing (not obvious from a fresh read)

- `article_kind: "content"` rows can have multiple DB rows sharing the same
  title (draft/supersedes-in-progress + the live published one) — always
  filter `status: "published"` when querying these 5 pages, or you'll get
  silently-wrong aggregate results (see bug #4 above).
- EditorJS list blocks store item text in `data.items[].content`, recursively
  nested via each item's own `.items` array — not in `data.text` like
  paragraph/header blocks. Any future text-extraction script touching
  `content_json` needs to walk both shapes.
- `content_json` JSON-stringified has the same href-escaping split noted in
  earlier sessions (`href="..."` becomes `href=\"...\"`) — still relevant, but
  this session's new script sidesteps it by reading `data.text`/`data.items`
  *before* stringifying, not the stringified blob.
- `git log --follow` on `content.mdx` does trace back through the
  `page.mdx` → `content.mdx` rename correctly in this repo (confirmed this
  session) — useful precedent for any future "what did this look like before
  the DB migration" question on the other static pages.
- `scripts/audit-evergreen-link-targets.ts` (new this session) complements
  `scripts/audit-evergreen-pages.ts` (existing) — the former checks link
  *shape* (dead/old-domain/preview-domain), the latter checks link *target
  correctness* by semantic comparison. Both are report-only, no `--execute`
  mode needed since neither writes anything.

## Suggested skills for next session

- No specialized skill fits "manually cross-reference ~30 flagged links
  against `/arhiv` search results and propose corrections" — this is
  domain-judgment work, best done directly in conversation with the user
  glancing at proposed corrections, possibly via a small review UI modeled on
  `scripts/review-link-fixes.ts` (existing Playwright-based
  Fix/Leave/Wrong-target/Research review page pattern, built for a different
  but structurally identical problem — legacy-migration link proposals).
- **`code-review`** — once Zgodovina's links are actually fixed (a batch
  content-editing script against a live page), worth a review pass same as
  suggested for the earlier fixes in this thread.
