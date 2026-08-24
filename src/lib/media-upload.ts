import { MEDIA_CDN_ORIGIN } from "~/lib/domains";

// Bare host, for consumers that match/compare hostnames rather than build
// urls (editor-utils.ts's hotlink regex, audit-evergreen-pages.ts).
export const MEDIA_PUBLIC_DOMAIN = new URL(MEDIA_CDN_ORIGIN).host;

// Media URLs are absolute and permanent from the moment they're written,
// since media is immutable.
export function media_url(key: string) {
	return `${MEDIA_CDN_ORIGIN}/${key}`;
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
