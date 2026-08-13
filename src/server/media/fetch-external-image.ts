import dns from "node:dns/promises";
import net from "node:net";

/**
 * Fetches a client-supplied URL for `POST /api/media`'s "import by URL" flow.
 *
 * Owns the policy for what counts as a safe external source, so it lives in
 * one place instead of being reinvented at each call site: only `http(s)`,
 * only hosts that resolve to a public IP (checked on the resolved address,
 * not just the literal hostname, so `localhost` and DNS-rebinding-style
 * hostnames are both caught), a request timeout, and a byte cap enforced
 * while streaming rather than after a full `.blob()`.
 *
 * Per CONTEXT.md, "signed in" and "is admin" are the same fact everywhere in
 * this app, so the caller here is "anyone who can sign in," not just the one
 * maintainer — this exists to keep that caller from turning the server into
 * an internal-network probe or an unbounded-memory sink.
 */

export const MAX_MEDIA_BYTES = 25 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 10_000;

export class UnsafeExternalUrlError extends Error {}
export class ExternalFetchTooLargeError extends Error {}

function is_private_ipv4(ip: string): boolean {
	const parts = ip.split(".").map(Number);
	if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
		return true;
	}
	const [a, b] = parts as [number, number, number, number];
	if (a === 0 || a === 10 || a === 127) return true;
	if (a === 169 && b === 254) return true;
	if (a === 172 && b >= 16 && b <= 31) return true;
	if (a === 192 && b === 168) return true;
	if (a >= 224) return true; // multicast + reserved
	return false;
}

function is_private_ipv6(ip: string): boolean {
	const normalized = ip.toLowerCase();
	if (normalized === "::1" || normalized === "::") return true;
	if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // fc00::/7 (ULA)
	if (/^fe[89ab]/.test(normalized)) return true; // fe80::/10 (link-local)
	if (normalized.startsWith("::ffff:")) {
		return is_private_ipv4(normalized.slice("::ffff:".length));
	}
	return false;
}

function is_private_ip(ip: string): boolean {
	return net.isIP(ip) === 6 ? is_private_ipv6(ip) : is_private_ipv4(ip);
}

async function assert_public_http_url(raw_url: string): Promise<URL> {
	let url: URL;
	try {
		url = new URL(raw_url);
	} catch {
		throw new UnsafeExternalUrlError(`Invalid URL: ${raw_url}`);
	}

	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new UnsafeExternalUrlError(`Unsupported protocol: ${url.protocol}`);
	}

	const addresses = await dns
		.lookup(url.hostname, { all: true })
		.catch(() => []);
	if (addresses.length === 0) {
		throw new UnsafeExternalUrlError(`Could not resolve host: ${url.hostname}`);
	}
	if (addresses.some((address) => is_private_ip(address.address))) {
		throw new UnsafeExternalUrlError(
			`Host resolves to a non-public address: ${url.hostname}`,
		);
	}

	return url;
}

export interface FetchExternalImageOptions {
	max_bytes?: number;
	timeout_ms?: number;
}

export async function fetch_external_image(
	raw_url: string,
	opts: FetchExternalImageOptions = {},
): Promise<{ bytes: Buffer; content_type: string }> {
	const max_bytes = opts.max_bytes ?? MAX_MEDIA_BYTES;
	const timeout_ms = opts.timeout_ms ?? DEFAULT_TIMEOUT_MS;

	const url = await assert_public_http_url(raw_url);

	const response = await fetch(url, {
		signal: AbortSignal.timeout(timeout_ms),
	});
	if (!response.ok) {
		throw new Error(`Fetch failed with status ${response.status}: ${raw_url}`);
	}

	const content_length = response.headers.get("content-length");
	if (content_length && Number(content_length) > max_bytes) {
		throw new ExternalFetchTooLargeError(
			`Response declares ${content_length} bytes, over the ${max_bytes} limit: ${raw_url}`,
		);
	}

	if (!response.body) {
		throw new Error(`Empty response body: ${raw_url}`);
	}

	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		if (!value) continue;

		total += value.byteLength;
		if (total > max_bytes) {
			await reader.cancel();
			throw new ExternalFetchTooLargeError(
				`Response exceeded the ${max_bytes} byte limit: ${raw_url}`,
			);
		}
		chunks.push(value);
	}

	return {
		bytes: Buffer.concat(chunks),
		content_type:
			response.headers.get("content-type") ?? "application/octet-stream",
	};
}
