# B2 buckets are fronted by Cloudflare custom domains, not raw B2 URLs

The media bucket sits behind a Cloudflare-proxied subdomain of `jknm.org` rather than being linked as a raw `f003.backblazeb2.com` URL, so the bucket-to-domain mapping lives in Cloudflare config, not in this repo's source:

- `gradivo.jknm.org` — CNAME to `f003.backblazeb2.com` (proxied, auto). Cloudflare URL Rewrite Rule `gradivo-b2-rewrite`: when hostname equals `gradivo.jknm.org`, rewrite path to `concat("/file/jknm-gradivo", http.request.uri.path)`. This is the EditorJS media bucket (`jknm-gradivo`, i.e. `NEXT_PUBLIC_AWS_MEDIA_BUCKET_NAME`), exported as `MEDIA_CDN_ORIGIN` in `src/lib/domains.ts`.

Because this mapping is Cloudflare-side, `jknm-gradivo` doesn't appear anywhere in `src/` or `.env.local` beyond that one constant — the bucket name itself isn't otherwise referenced, which is expected, not a sign the bucket doesn't exist. Any code that builds a canonical media URL should use `MEDIA_CDN_ORIGIN`, not a raw B2 URL or an unproxied bucket name.

`vsebina.jknm.org` (`jknm-vsebina`, the static-page content bucket) used to exist alongside it here, fronting `STATIC_CONTENT_PUBLIC_DOMAIN` — that whole path (`src/lib/static-content-upload.ts`, `src/components/image-with-caption.tsx`) had no remaining callers and was deleted. If a Cloudflare route for `vsebina.jknm.org` still exists, it's now dead infrastructure, not a live part of this app.
