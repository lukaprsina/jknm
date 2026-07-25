/**
 * Canonical production origin, for anything that must be an absolute URL a
 * crawler will see: `metadataBase`, `sitemap.ts`, `robots.ts`'s `sitemap`
 * field. Deliberately not `get_base_url()` (`~/lib/get-base-url.ts`) — that
 * falls back to `NEXT_PUBLIC_NEXTAUTH_URL`, which itself falls back to
 * `VERCEL_URL` on Vercel deployments, so it resolves to a `.vercel.app`
 * alias rather than the real domain. No env var owns this today, and it
 * only has one real value, so a constant beats inventing one.
 */
export const SITE_ORIGIN = "https://www.jknm.si";
