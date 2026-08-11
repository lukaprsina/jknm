"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

/** A `Link` to "/" that also resets scroll position when clicked while
 * already on the home page — a same-route click is a no-op navigation for
 * `next/link`, so it otherwise leaves the page exactly where it was. */
export function HomeLink({
	onClick,
	...props
}: Omit<ComponentProps<typeof Link>, "href">) {
	const pathname = usePathname();

	return (
		<Link
			href="/"
			onClick={(event) => {
				if (pathname === "/") window.scrollTo({ top: 0 });
				onClick?.(event);
			}}
			{...props}
		/>
	);
}
