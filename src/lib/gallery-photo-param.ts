import { MEDIA_CDN_ORIGIN } from "~/lib/domains";

/**
 * Codec for the gallery's `photo` query param. All EditorJS media lives at
 * `${MEDIA_CDN_ORIGIN}/<uuid>/original.<ext>` (see
 * `src/server/media/ingest.ts`'s `key` construction), so storing just the
 * CDN-relative suffix keeps shared/bookmarked gallery links short. Anything
 * not on the CDN (e.g. a legacy externally-hosted image ref) round-trips as
 * a full url instead, so encode/decode never lose information.
 */
const CDN_PREFIX = `${MEDIA_CDN_ORIGIN}/`;

export function encode_photo_param(url: string): string {
	return url.startsWith(CDN_PREFIX) ? url.slice(CDN_PREFIX.length) : url;
}

export function decode_photo_param(value: string): string {
	return /^https?:\/\//.test(value) ? value : `${CDN_PREFIX}${value}`;
}
