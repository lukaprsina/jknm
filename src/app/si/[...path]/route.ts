import type { NextRequest } from "next/server";
import { resolve_legacy_static_path } from "~/lib/legacy-si-paths";
import { legacy_gone, legacy_redirect } from "~/lib/site-config";

/**
 * Everything under old `/si/` other than the exact `/si/?id=` article shape
 * (handled by the sibling `si/route.ts`) — the old server's static-content
 * tree (`/si/klub/...`, `/si/jame/...`, etc, see `~/lib/legacy-si-paths`).
 * Catch-all, so it never collides with `si/route.ts`'s exact-`/si` match:
 * `[...path]` requires at least one segment.
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ path: string[] }> },
) {
	const { path } = await params;
	const resolution = resolve_legacy_static_path(path);

	if (resolution.outcome === "gone") {
		return legacy_gone();
	}

	return legacy_redirect(resolution.path, request);
}
