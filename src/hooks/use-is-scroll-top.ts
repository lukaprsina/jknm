"use client";

import { useEffect, useState } from "react";

/** Ported from fumadocs (`packages/radix-ui/src/utils/use-is-scroll-top.ts`)
 * -- drives the mobile navbar/TOC popover's "transparent until scrolled"
 * background, matching fumadocs.dev's own header behavior. */
export function useIsScrollTop(): boolean {
	const [is_top, setIsTop] = useState(true);

	useEffect(() => {
		const listener = () => {
			setIsTop(window.scrollY < 10);
		};

		listener();
		window.addEventListener("scroll", listener);
		return () => window.removeEventListener("scroll", listener);
	}, []);

	return is_top;
}
