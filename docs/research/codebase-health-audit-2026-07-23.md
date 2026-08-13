# Codebase health audit — outstanding findings

> Originally an outside read of `src/server`, the Drizzle schema, the oRPC routers, the
> EditorJS integration, auth wiring, and the media pipeline (2026-07-23). Re-verified against
> current code on 2026-08-13: 4 of the original 9 findings are fixed (cron path, hardcoded
> `Content-Length`, missing orphaned-media sweep, Algolia call inside a DB transaction) and
> have been dropped from this doc. The 5 below are still live. None is tracked by a GitHub
> issue yet.

## 1. Media upload: unvalidated server-side fetch of a client-supplied URL (SSRF-shaped)

`src/app/api/media/route.ts:43-44`:

```ts
const url_image_response = await fetch(external_url);
const blob = await url_image_response.blob();
```

`external_url` (`route.ts:28`, `form_data.get("url")`) is passed to `fetch` unchanged — no
scheme/host allowlist, no size cap before `.blob()`, no timeout. Gated behind
`getServerAuthSession()`, so not open to anonymous callers, but per `CONTEXT.md` "signed in"
and "is admin" are the same fact everywhere in this app — the trust boundary as written is
"anyone who can sign in," not "the one maintainer." Lower blast-radius than a traditional VPS
(no cloud metadata endpoint the way AWS/GCP expose one), but still an unauthenticated-to-the-
target SSRF gap: can probe internal Vercel/Supabase-adjacent hosts or blind-proxy requests
through this app's IP. The same route also buffers whole files into memory with no size check
(`route.ts:80`, `Buffer.from(await file.arrayBuffer())`) before `sharp` ever runs. Cheap
mitigations: restrict to `http(s)` with a public-hostname check, bound the response/file size
before buffering.

## 2. Google Admin member sync doesn't paginate

`src/server/author/sync_members.ts:33-35`:

```ts
const result = await service.users.list({ customer: "C049fks0l" });
```

The Google Admin SDK's `users.list` is paginated (default page size 100, 200 max) and returns
`nextPageToken` when more results exist. `fetch_google_members` reads `result.data.users` once
and never loops. Silently correct today at the club's current member count; the failure mode
once membership exceeds ~100-200 is silent data loss, not an error — `sync_members` would
upsert only the first page and never see (or flag as missing) anyone past it. Worth a
`nextPageToken` loop even though it isn't biting yet.

## 3. `media_upload_status_enum` is a vestigial async-pipeline abstraction

`src/server/db/schema.ts` declares a four-state enum (`pending`/`processing`/`completed`/
`failed`) for `Media.upload_status`. Nothing ever writes anything but `"completed"` — the sole
write site, `src/server/media/ingest.ts:282`, hardcodes it. Correctly reflects that async image
processing was decided against; the schema still carries the vocabulary of a rejected design,
which will mislead the next reader into thinking upload has failure/retry states it doesn't.
Either strip the enum to what's used, or add a one-line schema comment noting it's unused.

## 4. `NextResponse.error()` used for real application error responses

`src/app/api/media/route.ts` (auth failure, missing file, unrecognized `file_type`, non-object
file — 4 sites) all `return NextResponse.error()`. That API is documented by Next.js as
simulating a network error for `fetch`-level failure handling, not a general "something went
wrong" helper in a Route Handler — it carries no chosen status code and no message
distinguishing the four failure reasons. The EditorJS image-upload flow calling this route can
only see "the upload failed," never why. Prefer `NextResponse.json({ error: "..." }, { status
})` per failure mode.

## 5. oRPC is pinned to an exact beta version across four packages

`package.json`: `@orpc/client`, `@orpc/next`, `@orpc/server`, `@orpc/tanstack-query` are all
pinned to the literal `2.0.0-beta.18` (no `^`/`~`). Right call for a pre-1.0 dependency (avoids
an unreviewed beta-to-beta bump silently changing behavior), but all four have to be bumped
together, deliberately, by hand — nothing nudges the maintainer to do this. Not a bug, a
maintenance trap worth naming: revisit this pin on a schedule.
