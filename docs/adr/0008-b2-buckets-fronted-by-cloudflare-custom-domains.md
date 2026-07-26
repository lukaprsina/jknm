# B2 buckets are fronted by Cloudflare custom domains, not raw B2 URLs

Both content buckets sit behind Cloudflare-proxied subdomains of `jknm.org` rather than being linked as raw `f003.backblazeb2.com` URLs, so the bucket-to-domain mapping lives in Cloudflare config, not in this repo's source:

- `vsebina.jknm.org` — CNAME to `f003.backblazeb2.com` (proxied). Cloudflare URL Rewrite Rule `vsebina-b2-rewrite`: when hostname equals `vsebina.jknm.org`, rewrite path to `concat("/file/jknm-vsebina", http.request.uri.path)`. This is the static-page content bucket (`jknm-vsebina`).
- `gradivo.jknm.org` — CNAME to `f003.backblazeb2.com` (proxied, auto). Cloudflare URL Rewrite Rule `gradivo-b2-rewrite`: when hostname equals `gradivo.jknm.org`, rewrite path to `concat("/file/jknm-gradivo", http.request.uri.path)`. This is the current EditorJS media bucket (`jknm-gradivo`, i.e. `NEXT_PUBLIC_AWS_MEDIA_BUCKET_NAME`).

Because this mapping is Cloudflare-side, `jknm-vsebina` doesn't appear anywhere in `src/` or `.env.local` — grepping the codebase for it will find nothing, which is expected, not a sign the bucket doesn't exist. Any script or code that builds a canonical URL for a static-content asset should use `https://vsebina.jknm.org/<path>`, not a raw B2 URL or an unproxied bucket name.
