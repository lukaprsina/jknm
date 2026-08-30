"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";

/**
 * Carries the current path as `?next=` so signing in from a 404 (including
 * the unauthenticated-admin case, which 404s rather than redirects — see
 * `/uredi/[draft_id]/page.tsx`) returns the user to where they were instead
 * of always landing on `/`.
 */
export function PrijavaLink() {
	const pathname = usePathname();
	const href =
		pathname && pathname !== "/prijava"
			? `/prijava?next=${encodeURIComponent(pathname)}`
			: "/prijava";

	return (
		<Link href={href} className={cn(buttonVariants(), "no-underline")}>
			Prijava
		</Link>
	);
}
