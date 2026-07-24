"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * Updates query-string params via `window.history.replaceState` instead of
 * `router.replace`, so the URL stays bookmarkable/shareable without forcing
 * a Next.js navigation (no Suspense refetch, no server round trip).
 */
export function useShallowSearchParams() {
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const write = useCallback(
		(entries: Record<string, string | null>) => {
			const params = new URLSearchParams(searchParams.toString());
			for (const [key, value] of Object.entries(entries)) {
				if (value === null) params.delete(key);
				else params.set(key, value);
			}
			window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
		},
		[pathname, searchParams],
	);

	return { searchParams, write };
}
