// Public domain media is served from (Cloudflare-routed in front of the
// `jknm-gradivo` B2 bucket, per #12/#18) — media URLs are absolute and
// permanent from the moment they're written, since media is immutable.
export const MEDIA_PUBLIC_DOMAIN = "gradivo.jknm.org";

export function media_url(key: string) {
	return `https://${MEDIA_PUBLIC_DOMAIN}/${key}`;
}

export interface FileUploadResponse {
	success: 0 | 1;
	file?: FileUploadJSON | ImageUploadJSON;
	error?: "File exists";
}

export interface ImageUploadJSON {
	url: string;
	width?: number;
	height?: number;
}

export interface FileUploadJSON {
	url: string;
	title: string;
	size: number;
	name: string;
	extension: string;
}
