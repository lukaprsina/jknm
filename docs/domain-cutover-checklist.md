# jknm.si DNS cutover checklist

Runbook for the day `jknm.si`'s DNS moves from the old 2008-site host to Vercel. Background and
the roles behind each constant: `docs/architecture.md#domains`, `src/lib/domains.ts`,
[ADR-0010](adr/0010-domains-modeled-by-role.md).

Not automatic — every item below is a manual step, in roughly this order.

- [x] **DNS**: point `jknm.si` (and `www.jknm.si` if the old site served both) at Vercel, add
      both as domains on the Vercel project. `www.jknm.si` is canonical; bare `jknm.si` 308s to
      it. Done as of 2026-08-31.
- [x] **`NEXT_PUBLIC_DEPLOYMENT_ORIGIN`**: set to `https://www.jknm.si` in Vercel, Production
      environment (`vercel env rm`/`add` + `vercel --prod` redeploy, 2026-08-31).
- [x] **`src/lib/domains.ts`**: hand-edit `CANONICAL_ORIGIN` to the literal `https://www.jknm.si`
      (stop deriving it from `DEPLOYMENT_ORIGIN`) — commit this separately so the flip has its
      own line in `git blame`. Verified live: `/sitemap.xml` and `/robots.txt` now emit
      `www.jknm.si` URLs.
- [x] **Google Cloud Console** (OAuth client): add
      `https://www.jknm.si/api/auth/callback/google` as an authorized redirect URI. Done ahead of
      the rest of this cutover. `jknm.localhost`/`jknm-si.vercel.app`/`jknm.org` were dropped from
      `allowedHosts` (`src/server/auth/index.ts`) since dev no longer runs through a `portless`
      proxy (Google rejects the non-standard `.localhost` TLD) and the transitional hosts are no
      longer needed; only `jknm.si`, `www.jknm.si`, `localhost:3000` remain.
- [ ] **Resend**: skipped for now — the `jknm.si` DNS owner hasn't configured mail there yet.
      `MAIL_FROM_DOMAIN` stays `"jknm.org"` until that changes; revisit this item later, not part
      of this cutover.
- [x] **Smoke test on the real domain**: sign-in and contact form confirmed working on
      `www.jknm.si` (2026-08-31).
- [ ] **Old site decommission**: once traffic and search rankings have settled on the new domain,
      remove the `jknm-si.vercel.app` Google OAuth redirect URI if one was added.

## Explicitly out of scope for cutover day

- **`gradivo.jknm.org` staying `.org`**: not part of this checklist. If it's ever moved to
  `.si`, that's a separate project — a script to rewrite every article's `content_json` media
  URLs, then repoint the Cloudflare custom domain — done after the cutover has settled, not
  during it.
- **`LEGACY_SITE_ORIGIN`**: stays `https://www.jknm.si` forever, pointing at what is now *this*
  app rather than the old one. It only matters for recognizing old pasted links, which remains
  correct either way — the string doesn't need to change even though what it resolves to does.
