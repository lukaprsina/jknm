import { env } from "~/env";

/**
 * Where *this* deployment is actually reachable right now. Set explicitly
 * per environment (never inferred from `VERCEL_URL`, which is unreliable —
 * it's the deployment's auto-generated host, not necessarily the assigned
 * alias, and carries no protocol). Drives better-auth's `baseURL` and the
 * Google OAuth redirect URI, so it must match what's configured there.
 */
export const DEPLOYMENT_ORIGIN = env.NEXT_PUBLIC_DEPLOYMENT_ORIGIN;

/**
 * Public identity for anything that must be a stable absolute URL a crawler
 * or search index will see: `metadataBase`, `sitemap.ts`, `robots.ts`,
 * Algolia permalinks. Hand-edited to the literal domain on `jknm.si` cutover
 * day (2026-08-31) rather than derived from `DEPLOYMENT_ORIGIN`, so a future
 * per-environment change to `DEPLOYMENT_ORIGIN` can't silently drag the
 * public identity along with it.
 */
export const CANONICAL_ORIGIN = "https://www.jknm.si";

/**
 * The pre-rewrite 2008 site (`jknm.si`, classic-ASP). Used only to
 * recognize and rewrite links pasted from it into article/static content —
 * never changes regardless of the DNS cutover, since it names a fact about
 * old content, not about where this app lives.
 */
export const LEGACY_SITE_ORIGIN = "https://www.jknm.si";

/**
 * Cloudflare-routed custom domain in front of the `jknm-gradivo` B2 bucket
 * (immutable EditorJS media). Independent lifecycle from the app's own
 * domain — the Cloudflare-side routing is what actually maps this to the
 * bucket, not anything in this repo.
 */
export const MEDIA_CDN_ORIGIN = "https://gradivo.jknm.org";

/** Google Workspace membership domain and the club's human-facing address. */
export const WORKSPACE_EMAIL_DOMAIN = "jknm.si";
export const CONTACT_EMAIL = `info@${WORKSPACE_EMAIL_DOMAIN}`;

/**
 * Resend-verified sender domain for the contact form — deliberately NOT
 * `WORKSPACE_EMAIL_DOMAIN`. The club's real mail is on `jknm.si` (Google
 * Workspace), but only `jknm.org` is SPF/DKIM-verified in Resend today.
 * Switch this once `jknm.si` is verified there too.
 */
export const MAIL_FROM_DOMAIN = "jknm.org";
