# better-auth: facts for the NextAuth v4 migration (#32)

> **Status (2026-07-23): implemented.** Issue #32 is closed; the migration described here has
> shipped — see `docs/architecture.md`'s "Auth" section for current state. Kept as reference
> facts about better-auth's schema/API, still accurate as vendored-doc citations.

Reference material for whoever implements #32. **This document holds facts; #32 holds
decisions.** Where the two disagree, #32 wins — but check whether this file explains why.

Sources: the vendored submodule at `vendor/better-auth` (**version 1.6.23**, confirmed at
`vendor/better-auth/packages/better-auth/package.json`). Doc citations below are relative to
`vendor/better-auth/docs/content/docs/`. Run `git submodule update --init` if `vendor/` is empty.

Claims are marked:

- **[docs]** — stated in the vendored documentation, cited.
- **[source]** — verified directly against the vendored package source or `package.json`.
- **[gap]** — the docs do not state this. Do not fill the gap from memory; verify.

---

## 1. Core schema

**[docs]** `concepts/database.mdx`; comparison table in `guides/next-auth-migration-guide.mdx`.

**`user`** — `id` (string, PK), `name` (string, **required**), `email` (string, required, unique),
`emailVerified` (**boolean**, required), `image` (string, optional), `createdAt` (Date),
`updatedAt` (Date).

**`session`** — `id` (PK), `userId` (FK → user.id, cascade), `token` (string, unique — the cookie
value), `expiresAt` (Date), `ipAddress` (optional), `userAgent` (optional), `createdAt`,
`updatedAt`.

**`account`** — `id` (PK), `userId` (FK, cascade), `accountId` (provider's own ID), `providerId`,
`accessToken`, `refreshToken`, `accessTokenExpiresAt`, `refreshTokenExpiresAt`, `scope`,
`idToken`, `password` (credentials only), `createdAt`, `updatedAt`.

**`verification`** — `id`, `identifier`, `value`, `expiresAt`, `createdAt`, `updatedAt`.

### Diff against what this repo has today

This repo's tables are in `src/server/db/schema.ts`. Three of four **table names already match**
better-auth's defaults — `user`, `account`, `session` — and only `verification_token` differs
(better-auth wants `verification`). **Column** names and types differ throughout:

| | this repo (NextAuth v4) | better-auth |
|---|---|---|
| `user.emailVerified` | nullable `timestamp` | required **boolean** |
| `user.name` | nullable | **required** |
| `user` timestamps | none | `createdAt`, `updatedAt` required |
| session token | `sessionToken` | `token` |
| session expiry | `expires` | `expiresAt` |
| account provider | `provider` | `providerId` |
| account provider id | `providerAccountId` | `accountId` |
| account tokens | `refresh_token`, `access_token` (snake) | `refreshToken`, `accessToken` (camel) |
| account expiry | `expires_at` (integer) | `accessTokenExpiresAt` / `refreshTokenExpiresAt` (Date) |
| account `type` | present | **removed** — inferred from `providerId` |
| account `token_type`, `session_state` | present | **removed** |

**[docs]** Table and column names are remappable via `modelName` and `fields` per model
(`concepts/database.mdx`, "Custom Table Names"). #32 decides **not** to use this — mapping would
freeze NextAuth's snake_case column names in place forever.

---

## 2. The `emailVerified` trap — read this before writing the migration

**[docs]** `reference/errors/account_not_linked.mdx`, under "Verify user identity matching":

> Ensure the matching existing user has `emailVerified: true`, especially if the user row was
> inserted manually.

This is the single most load-bearing fact for #32's strategy. Preserved `user` rows come from a
schema where `emailVerified` is a nullable timestamp. If the conversion to boolean yields `false`,
account linking can fail — better-auth then creates a **new** user with a **new id**, and
`Article.created_by` / `Media.user_id` are orphaned across the whole archive.

Set `emailVerified = true` explicitly on every preserved row. Every existing row is a
Google-verified `@jknm.si` address, so this is correct as well as necessary.

**[gap]** The docs do not state precisely whether the *local* row's `emailVerified` is read as a
gate during the linking decision, or whether the errors page is merely troubleshooting heuristics.
Treat it as load-bearing regardless — the downside is asymmetric.

---

## 3. Account linking

**[docs]** `concepts/users-accounts.mdx`, `reference/options.mdx`.

```ts
account: {
  accountLinking: {
    enabled: true,                    // default
    trustedProviders: ["google"],
    allowDifferentEmails: false,      // default
  },
},
```

Linking occurs when the incoming OAuth email **matches an existing user row**, and *either* the
provider reports the email verified *or* the provider is listed in `trustedProviders`.

- `disableImplicitLinking` defaults to `false` and **must stay that way**. Enabling it returns
  `account_not_linked` to returning editors instead of logging them in.
- `updateUserInfoOnLink` defaults to `false`. Note: "The local `email` and `emailVerified` are
  never changed."
- **No pre-existing `account` row is required.** better-auth creates it on first successful
  matched sign-in — this is what makes #32's drop-and-relink strategy work.

**[docs]** Warning attached to `trustedProviders` (`concepts/users-accounts.mdx`):

> …their account will be automatically linked even if the provider doesn't confirm the email
> verification status. Use this with caution as it may increase the risk of account takeover.

Accepted in #32 on narrow grounds: the sign-in predicate independently rejects anything that is
not Google + verified + `@jknm.si`, so a trusted link can only occur for an identity that already
passed the full gate.

---

## 4. The sign-in gate — three candidate wiring points, only one works

better-auth has **no equivalent of NextAuth's `signIn` callback**. This is the migration's least
obvious problem.

| Mechanism | Verdict | Why |
|---|---|---|
| `databaseHooks.user.create.before` | ✗ | **[docs]** `concepts/database.mdx` — fires only on *new user creation*. Every returning editor bypasses the gate. |
| `hooks.before` + `createAuthMiddleware` | ✗ | **[docs]** `concepts/hooks.mdx` has a domain-restriction example, but keyed to `/sign-up/email`. **[gap]** the docs never show the raw Google `email_verified` claim being reachable from this middleware on the OAuth callback path — so it cannot enforce the verified-email clause. |
| **custom `getUserInfo` on the Google provider** | ✓ | **[docs]** `concepts/oauth.mdx`, "Server-Owned Fields and Authorization Claims": *"For flows that invoke `getUserInfo`, a custom implementation can verify the provider response and return `null` when the policy fails."* It sees the provider profile including `email_verified`. |

**[docs]** Rejection is `throw new APIError("BAD_REQUEST", { message })` from `better-auth/api`
in the hook mechanisms; in `getUserInfo` it is returning `null`.

### Why `hd` is not also set

**[docs]** `authentication/google.mdx` offers `hd: "domain.com"` to restrict sign-in to a Google
Workspace. But the same page states a custom `getUserInfo` **replaces** Google's built-in
callback-path `hd` check. Configuring both would look like two gates while only one runs.
#32 picks `getUserInfo` — one gate, one test surface.

**[gap]** The docs do not say whether `hd` works for anything other than a real Google Workspace
domain. Irrelevant given the above, but note it if the decision is ever revisited.

---

## 5. Next.js App Router integration

**[docs]** `integrations/next.mdx`, `basic-usage.mdx`, `installation.mdx`.

Route handler at `app/api/auth/[...all]/route.ts`:

```ts
import { auth } from "~/server/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

Server-side session read (Server Component or server action):

```ts
const session = await auth.api.getSession({ headers: await headers() });
```

Returns `{ session, user }` — **not** NextAuth's `{ user, expires }`. #32's seam-1 wrapper adapts
between the two, which is what keeps all 15 call sites unchanged.

Type inference **[docs]** `concepts/typescript.mdx`: `type Session = typeof auth.$Infer.Session`.

**Google redirect URI is `{baseURL}/api/auth/callback/google`** — identical to NextAuth v4's, so
no Google Cloud Console change is expected. Confirm before deploying.

### Next-specific caveats

- **[docs]** `nextCookies()` plugin is needed only for auth calls initiated from **Server Actions**
  (`signInEmail`-style). This app's only flow is the OAuth redirect through the route handler, so
  it is not required. If ever added, it must be **last** in the `plugins` array.
- **[docs]** RSCs cannot set cookies, so a cookie cache would not refresh until a Server Action or
  Route Handler runs.
- **[docs]** Next 16 renames middleware → proxy; better-auth documents a `proxy.ts` example but
  also quotes Next's own guidance that it "should not be used as a full session management or
  authorization solution," recommending per-page checks instead. **This app has no middleware and
  #32 adds none.**
- **[docs]** `getSessionCookie()` from `better-auth/cookies` checks cookie *existence only, not
  validity* — carries an explicit security warning. Never protect a mutation with it.

---

## 6. Drizzle adapter — docs contradict themselves; source settles it

**[docs]** `installation.mdx` shows `better-auth/adapters/drizzle`; `adapters/drizzle.mdx` shows a
standalone `@better-auth/drizzle-adapter` package. The docs never reconcile this.

**[source]** Resolved: `packages/better-auth/src/adapters/drizzle-adapter/index.ts` is exactly

```ts
export * from "@better-auth/drizzle-adapter";
```

and `@better-auth/drizzle-adapter` is a **hard `dependencies` entry** of `better-auth` (not peer,
not optional). Therefore both import paths work, resolve to identical code, and neither is
deprecated. `bun add better-auth` is the entire install. **Use `better-auth/adapters/drizzle`.**

**[source]** Peer requirements vs. this repo — exact match, **no ORM upgrade is part of #32**:

| peer | required | repo has |
|---|---|---|
| `drizzle-orm` | `^0.45.2` (optional) | `^0.45.2` |
| `drizzle-kit` | `>=0.31.4` (optional) | `^0.31.10` |

Setup:

```ts
database: drizzleAdapter(db, { provider: "pg" }),
```

### Migrations

**[docs]** `concepts/cli.mdx`, `adapters/drizzle.mdx`, `concepts/database.mdx`:

- `npx auth@latest generate` emits a Drizzle `schema.ts` (`--output`, `--config`, `--yes`).
- **`npx auth@latest migrate` does NOT support Drizzle** — Kysely only.
- The programmatic `getMigrations` API **also does not support Drizzle**.
- Apply through Drizzle's own tooling — this repo already has `db:generate` / `db:migrate` scripts.

---

## 7. Client API

**[docs]** `installation.mdx`, `basic-usage.mdx`.

```ts
import { createAuthClient } from "better-auth/react";
export const authClient = createAuthClient(); // baseURL optional when same-origin
```

```ts
await authClient.signIn.social({
  provider: "google",
  callbackURL: "/",          // the equivalent of NextAuth's callbackUrl; defaults to "/"
  errorCallbackURL: "/error",
  newUserCallbackURL: "/welcome",
});

await authClient.signOut();
// with redirect:
await authClient.signOut({ fetchOptions: { onSuccess: () => router.push("/") } });
```

---

## 8. Sessions

**[docs]** `concepts/session-management.mdx`. Database sessions are the **default** whenever a
database is configured. Cookie-based session id; stateless mode is only automatic with no database.

- `expiresIn` default 7 days; `updateAge` default 1 day (sliding refresh); `freshAge` default 1 day.
- **Cookie caching is opt-in and off by default.** #32 leaves it off. The docs are explicit:
  "revoked sessions may remain active on other devices until the cookie cache expires." With a
  handful of editors there is no database load worth trading sign-out correctness for.

---

## 9. Environment variables

**[docs]** `reference/options.mdx`, `installation.mdx`, `authentication/google.mdx`.

| today | becomes | note |
|---|---|---|
| `NEXTAUTH_SECRET` | **`BETTER_AUTH_SECRET`** | `AUTH_SECRET` also accepted; the NextAuth name is **not**. ≥32 chars. Throws in production if unset. |
| `NEXTAUTH_URL` | **`BETTER_AUTH_URL`** | Must be explicit in production — request inference is "not recommended" and causes Google `redirect_uri_mismatch`. |
| `GOOGLE_CLIENT_ID` / `_SECRET` | unchanged | only the config wiring moves |
| `NEXT_PUBLIC_NEXTAUTH_URL` | re-examine | the client can omit `baseURL` entirely when same-origin; this variable and its `VERCEL_URL` preprocessing may be deletable |

`trustedOrigins` is config-only in all doc examples; **[gap]** no env var is documented for it.

**Update the Vercel environment before deploying** or the app boots into `src/env.js`'s
invalid-environment crash.

---

## 10. Testing

**[gap]** The docs describe **no** testing story: no test adapter guidance, no OAuth mocking, no
statement about PGlite compatibility.

**[source]** However, `@better-auth/memory-adapter` is a **hard dependency** of `better-auth` and a
published export at `better-auth/adapters/memory`. It is *undocumented, not unsupported*. There is
also a `packages/test-utils` in the vendored monorepo.

This does not change #32's test plan — its two targets (the sign-in predicate and the session-shape
adapter) are pure and need no adapter at all. But if an integration-level test is ever wanted,
`better-auth/adapters/memory` is a better path than pointing the Drizzle adapter at PGlite.

---

## 11. Gotchas, consolidated

1. `emailVerified = true` on preserved rows — §2. **The one that can orphan the archive.**
2. Never set `disableImplicitLinking: true` — returning editors would get `account_not_linked`.
3. `auth migrate` and `getMigrations` do not support Drizzle — use `drizzle-kit`.
4. A custom `getUserInfo` **replaces** the built-in `hd` check; do not configure both.
5. `getSessionCookie()` does not validate — never use it to protect a mutation.
6. `BETTER_AUTH_URL` must be explicit in production.
7. `nextCookies()` must be last in `plugins` if it is ever added.
8. Cookie cache (if ever enabled) delays session revocation across devices.
9. **[docs]** `concepts/database.mdx` / `concepts/oauth.mdx`: any custom `user` field that
   represents server-owned state must be declared `input: false`, or generic API input and
   `mapProfileToUser` (i.e. Google's profile) can overwrite it. Relevant if roles are ever added.
10. Passwords, if ever added, live in `account.password` — **never** on `user`.

---

## Not verified here

- Whether `@jknm.si` is backed by a real Google Workspace. Moot for #32 (`hd` is not used), but it
  would matter if the gate were ever rewired.
- The actual runtime behaviour of the OAuth round trip. No unit test can cover it — #32 requires
  manual verification that a returning editor lands on their **pre-existing** user id with article
  authorship intact.
