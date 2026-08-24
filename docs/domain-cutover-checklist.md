# jknm.si DNS cutover checklist

Runbook for the day `jknm.si`'s DNS moves from the old 2008-site host to Vercel. Background and
the roles behind each constant: `docs/architecture.md#domains`, `src/lib/domains.ts`,
[ADR-0010](adr/0010-domains-modeled-by-role.md).

Not automatic — every item below is a manual step, in roughly this order.

- [ ] **DNS**: point `jknm.si` (and `www.jknm.si` if the old site served both) at Vercel, add
      both as domains on the Vercel project.
- [ ] **`NEXT_PUBLIC_DEPLOYMENT_ORIGIN`**: set to `https://www.jknm.si` (or `https://jknm.si`,
      whichever becomes canonical) in the Vercel dashboard, Production environment.
- [ ] **`src/lib/domains.ts`**: hand-edit `CANONICAL_ORIGIN` to the literal `https://www.jknm.si`
      (stop deriving it from `DEPLOYMENT_ORIGIN`) — commit this separately so the flip has its
      own line in `git blame`.
- [ ] **Google Cloud Console** (OAuth client): add
      `https://www.jknm.si/api/auth/callback/google` as an authorized redirect URI. Leave the
      `jknm-si.vercel.app` one in place until confident nothing still depends on it.
- [ ] **`src/server/auth/index.ts`**: `trustedOrigins` already lists `jknm.org` and
      `jknm-si.vercel.app` — no change needed unless one of those is being retired too.
- [ ] **Resend**: ask the old site's maintainer (they hold the `jknm.si` DNS) to add the SPF/DKIM
      records Resend requires to verify `jknm.si` as a sending domain.
- [ ] **`src/lib/domains.ts`**: once verified, change `MAIL_FROM_DOMAIN` from `"jknm.org"` to
      `"jknm.si"`. Decide at the same time whether `send/route.ts`'s `to:` inbox should also move
      off `info@jknm.org`, or stay as a dedicated support inbox — that's a live decision, not a
      mechanical rename.
- [ ] **Smoke test on the real domain** before deleting anything: sign in with Google, submit the
      contact form, check `/sitemap.xml` and a published article's OG tags resolve to
      `www.jknm.si` URLs, not the `.vercel.app` alias.
- [ ] **Old site decommission**: once traffic and search rankings have settled on the new domain,
      remove the `jknm-si.vercel.app` Google OAuth redirect URI and `trustedOrigins` entry.

## Explicitly out of scope for cutover day

- **`gradivo.jknm.org` staying `.org`**: not part of this checklist. If it's ever moved to
  `.si`, that's a separate project — a script to rewrite every article's `content_json` media
  URLs, then repoint the Cloudflare custom domain — done after the cutover has settled, not
  during it.
- **`LEGACY_SITE_ORIGIN`**: stays `https://www.jknm.si` forever, pointing at what is now *this*
  app rather than the old one. It only matters for recognizing old pasted links, which remains
  correct either way — the string doesn't need to change even though what it resolves to does.
