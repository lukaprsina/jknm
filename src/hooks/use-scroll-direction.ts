"use client";

import { useEffect, useState } from "react";

/** Vanilla scroll-direction tracker, matching `useIsScrollTop`'s style (raw
 * `window.scrollY` listener, no framer-motion/usehooks-ts) -- direction only
 * flips once the delta since the last flip exceeds `threshold`, so small
 * jitters (e.g. rubber-band bounce at the top) don't toggle it back and
 * forth. */
export function useScrollDirection(threshold = 10): "up" | "down" {
	const [direction, setDirection] = useState<"up" | "down">("up");

	useEffect(() => {
		let last_scroll_y = window.scrollY;

		const listener = () => {
			const scroll_y = window.scrollY;
			const diff = scroll_y - last_scroll_y;

			if (Math.abs(diff) < threshold) return;

			setDirection(diff > 0 ? "down" : "up");
			last_scroll_y = scroll_y;
		};

		window.addEventListener("scroll", listener, { passive: true });
		return () => window.removeEventListener("scroll", listener);
	}, [threshold]);

	return direction;
}
