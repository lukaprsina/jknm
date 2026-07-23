# Codebase health audit (2026-07-23)

An outside read of `src/server`, the Drizzle schema, the oRPC routers, the EditorJS
integration, auth wiring, and the media pipeline — general Next.js/Vercel/Supabase/
Drizzle/better-auth engineering judgment applied to what's actually in this repo, not a
restatement of what the ADRs/issues/`docs/bugs` already track. Every claim below is cited
to `file:line`; none of it duplicates a currently-open issue (all 32 GitHub issues are
closed as of this audit).

## 1. The Supabase keep-alive cron almost certainly never fires — wrong path

`vercel.json:3-8` schedules a weekly cron at `/api/wake-supabase`:

```json
{ "crons": [{ "path": "/api/wake-supabase", "schedule": "0 0 * * 1" }] }
```

But the actual route lives at `src/app/api/wake_supabase/route.ts` — **underscore, not
hyphen** — which serves `/api/wake_supabase`. Vercel's cron dispatcher hits the literal
configured path; a route that doesn't exist there 404s (Vercel logs this as a failed
invocation, but nothing in-app surfaces it). The entire point of this endpoint, per its own
name, is to stop Supabase's free-tier pause-on-inactivity from cold-starting the DB
(ADR-0004 §"Database" names this exact failure mode as the reason to eventually leave
Supabase) — if the cron has been silently 404ing since it was configured, that protection
has never actually run. Trivial fix (rename one side to match the other), high-value catch:
confirm in the Vercel dashboard's cron invocation history, then fix.

## 2. Media upload declares a hardcoded, wrong `Content-Length` to B2

`src/app/api/media/route.ts:166-169`:

```ts
await bucket_obj.upload(key, buffer, {
    contentType: mime_type,
    contentLength: 5 * 10485760,
});
```

`contentLength` is hardcoded to 52,428,800 bytes (50 MiB) regardless of `buffer.byteLength`
— every upload, including a 20 KB thumbnail, declares a fixed 50 MB body size to an
S3-compatible PUT. S3-family APIs use `Content-Length` to know when the request body has
finished arriving; declaring a length larger than what's actually sent risks the upload
call hanging until the underlying HTTP client's timeout, depending on how `b2-js` frames
the request (whether it sets the header verbatim from this option or streams and lets the
transport compute it). At minimum this is dead/wrong code that happens to work only because
`b2-js` doesn't strictly enforce the declared value the same way raw S3 does; at worst it's
a live source of the "upload hangs/times out" class of bug for any user directly on the
edge of what the client tolerates. The fix is one line: `contentLength: buffer.byteLength`.
Also worth noting there is no actual enforcement of a 50 MB (or any) cap — the "50 MB" in
this constant is not a real limit anywhere else in the handler, just a fixed wrong number
that happens to look like a limit.

## 3. Media upload: unvalidated server-side fetch of a client-supplied URL

`src/app/api/media/route.ts:100,115`:

```ts
const external_url = form_data.get("url");
...
const url_image_response = await fetch(external_url);
```

Gated behind `getServerAuthSession()` (`route.ts:93-94`), so this isn't open to anonymous
callers — but per `CONTEXT.md`, "signed in" and "is admin" are the same fact everywhere in
this app, meaning any authenticated session (a single Google-Workspace-verified admin
today, but the trust boundary as written is "anyone who can sign in," not "the one
maintainer") can make the Vercel function fetch an arbitrary URL server-side with no
scheme/host allowlist, no size cap before `.blob()`, and no timeout. On Vercel this is lower
blast-radius than a traditional VPS (no cloud metadata endpoint to reach the way AWS/GCP
would expose one), but it is still unauthenticated-to-the-target SSRF: it can be used to
probe internal Vercel/Supabase-adjacent hosts, hit `localhost`-scoped services other
functions might expose, or as a blind proxy to make outbound requests that appear to
originate from this app's IP. Cheap mitigations if this is ever revisited: restrict to
`http(s)` with a public-hostname check, and bound the response size before buffering it into
memory.

## 4. Whole files are buffered into function memory with no size limit

`src/app/api/media/route.ts:157-158` (`await file.arrayBuffer()`) and the external-URL path
(`:116`, `await url_image_response.blob()`) both load the entire upload into memory before
any size check. Combined with finding #2 (uploads never actually enforce the 50 MB the
`contentLength` constant implies), a large file — accidental or adversarial, from any signed-
in session — can be a full memory-sized buffer on a serverless function with a fixed memory
ceiling, well before `sharp` even runs. Next.js Route Handlers on Vercel don't give you a
built-in multipart size cap the way, say, a raw body-size limit config does for some other
frameworks; this one has to be added explicitly (check `form_data.get("file")`'s size, or
the `Content-Length` header, before reading the body) and currently isn't.

## 5. Orphaned media has no sweep — unbounded storage growth

`CONTEXT.md`'s glossary claimed an "orphaned media (no links, 48h old) is swept" step exists
(now corrected in this pass). It does not: `reconcile_media_to_articles`
(`src/server/article/reconcile-media.ts:20-122`) only ever deletes `media_to_articles` join
rows, never `media` rows themselves, and a repo-wide search turns up no cron, route, or
script that deletes an unreferenced `media` row — the only place `Media` rows are ever
deleted at all is the one-off `scripts/fix-thumbnail-media-extensions.ts:144`, a manual
repair script, not a scheduled sweep. Every discarded draft, replaced image, or abandoned
upload leaves its B2 object and its `media` row permanently — this is a real, compounding
cost (B2 storage) and DB bloat source with nothing bounding it, on a site whose whole
architecture (`Media` is explicitly immutable per `docs/architecture.md`) *depends on*
something eventually cleaning up the immutable rows nothing points to anymore. Worth a
scheduled job (Vercel cron, same mechanism as the wake-supabase one) doing exactly what the
glossary already assumed existed: delete `media` rows with no `media_to_articles` row and
`created_at` older than some grace window.

## 6. Algolia write happens inside a Postgres transaction that's already holding a row lock

`src/server/article/new-article.ts:290-386` (`publish_article`): the supersede-publish path
takes an explicit `SELECT ... FOR UPDATE` lock on the superseded row inside
`resolve_supersede_publish_slug` (`new-article.ts:82-86`, "Lock the superseded row so two
concurrent supersede-publishes... serialize instead of racing"), and *after* that lock is
taken, still inside the same `db.transaction` callback, the code calls out to the network:
`algolia.addOrUpdateObject(...)` at `new-article.ts:370-379`. Two separate problems:

- **Lock hold time now includes Algolia's round-trip latency.** Any concurrent
  supersede-publish of the same source article blocks not just for the DB write but for
  however long the Algolia API call takes — turning a fast, well-scoped lock into one held
  for an external HTTP call's duration. On Supabase's connection-pooled Postgres this also
  ties up a pooled connection for that whole window.
- **No compensation if the transaction fails after the Algolia call succeeds.** If
  `find_article_with_relations` (called just before, `:359-363`) or the transaction's own
  commit fails for any reason after `addOrUpdateObject` has already succeeded, Algolia now
  has content indexed that the database never committed — a real, if narrow, source of
  Algolia/Postgres drift with no retry or reconciliation path. The safer shape is to commit
  the transaction first, then push to Algolia afterward (accepting the narrower risk of "DB
  committed, Algolia push failed" instead, which is easier to backfill than the reverse).

`lifecycle.ts`'s `remove_from_algolia` (referenced from `lifecycle.ts:31-44` per ADR-0003 and
called by `archive_article`/`delete_article`) should be checked for the same pattern before
assuming it's fine — not re-verified line-by-line in this pass, flagged as the same class of
risk to check.

## 7. Google Admin member sync doesn't paginate

`src/server/author/sync_members.ts:33-35`:

```ts
const result = await service.users.list({ customer: "C049fks0l" });
```

The Google Admin SDK's `users.list` is a paginated endpoint (default page size is 100, `200`
max per page) and returns `nextPageToken` when more results exist. `fetch_google_members`
(`sync_members.ts:15-64`) reads `result.data.users` once and never checks
`result.data.nextPageToken` or loops to fetch subsequent pages. For a small caving club this
is very likely under the page size today, so it silently works — but it is not correct as
written, and the failure mode when the club eventually exceeds ~100-200 members (or Google
changes the default page size) is not an error, it's **silent data loss**: `sync_members`
(`sync_members.ts:100-130`) would upsert only the first page and never touch (nor flag as
"missing," since the diff logic never sees them) members beyond it. Worth a
`nextPageToken` loop even though it isn't biting today.

## 8. `media_upload_status_enum` is a vestigial async-pipeline abstraction

`src/server/db/schema.ts:183-188` declares a four-state enum (`pending` / `processing` /
`completed` / `failed`) for `Media.upload_status`, clearly modeling an async
upload-then-process pipeline. Nothing in the codebase ever writes anything other than
`"completed"` — the sole insert site, `src/app/api/media/route.ts:210`, hardcodes
`upload_status: "completed"` unconditionally, and a repo-wide search for the other three
enum values (outside the schema declaration itself) finds no other reference. This
correctly reflects that issue #11 ("Decide: async image pipeline") was decided *against*
async processing — but the schema still carries the vocabulary of a pipeline that was
rejected, which will mislead the next reader into thinking upload has failure/retry states
it doesn't have. Either strip the enum down to what's actually used, or add a one-line
schema comment noting it's aspirational/unused, so nobody builds retry logic against a
`"failed"` state that nothing ever sets.

## 9. `NextResponse.error()` used for real application error responses

`src/app/api/media/route.ts:94,143,146,149` use `NextResponse.error()` for four distinct
failure modes (not authenticated, missing file, unrecognized `file_type`, non-object file).
`NextResponse.error()` is documented by Next.js as producing a response that *simulates a
network error* — its intended use is signaling `type: "error"` for `fetch`-level failure
handling (originally a `middleware.ts` construct), not as a general-purpose "something went
wrong" helper in a Route Handler. It carries no status code the caller chose and no message
body distinguishing the four different failure reasons above. Client code calling this route
(the EditorJS image-upload flow) can only see "the upload failed," never *why* — worse
diagnostics for the one class of failure (auth/session expiry vs. a malformed request) an
admin most needs distinguished when something breaks mid-edit. Prefer
`NextResponse.json({ error: "..." }, { status: 401 | 400 })` per failure mode.

## 10. oRPC is pinned to an exact beta version across four packages

`package.json`: `@orpc/client`, `@orpc/next`, `@orpc/server`, `@orpc/tanstack-query` are all
pinned to the literal `2.0.0-beta.18` (no `^`/`~`), consistent with
`docs/research/orpc-adoption-plan.md`'s own note that oRPC 2.0 ships under the `@beta`
dist-tag. Exact-pinning is the right call for a pre-1.0 dependency (avoids an unreviewed
beta-to-beta bump silently changing behavior), but it means **all four packages have to be
bumped together, deliberately, by hand** — nothing will nudge the maintainer to do this, and
beta-to-beta diffs for a library this central to every mutation and cache invalidation are
exactly the kind of change worth reading before taking. Not a bug, just a maintenance trap
worth naming: revisit this pin on a schedule, don't wait for something to force it.

## Summary — top findings by likely impact

1. **Wake-Supabase cron path mismatch** (`vercel.json:5` vs `src/app/api/wake_supabase/`) —
   the anti-cold-start mechanism has likely never fired. Cheapest fix in this list, worth
   confirming first.
2. **No orphaned-media sweep exists**, despite the architecture assuming one (`CONTEXT.md`,
   now corrected) — unbounded B2 storage/DB growth with no cap.
3. **Media upload's hardcoded wrong `Content-Length`** (`route.ts:168`) — a live footgun on
   every upload, not just an edge case.
4. **Algolia call inside a DB transaction holding a row lock** (`new-article.ts:370-379`) —
   extends lock hold time by network latency and can desync Algolia from Postgres on a
   late transaction failure.
5. **Unvalidated server-side fetch of a client-supplied URL** in the media upload route — an
   SSRF-shaped gap, low severity at this trust level but free to close.
