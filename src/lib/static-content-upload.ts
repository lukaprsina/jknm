// Static-page assets (PDFs referenced from src/app/(static)) are served from
// vsebina.jknm.org, Cloudflare-routed in front of the `jknm-vsebina` B2
// bucket — see ADR-0008.
export const STATIC_CONTENT_PUBLIC_DOMAIN = "vsebina.jknm.org";

export function static_content_url(key: string) {
	return `https://${STATIC_CONTENT_PUBLIC_DOMAIN}/${key}`;
}
