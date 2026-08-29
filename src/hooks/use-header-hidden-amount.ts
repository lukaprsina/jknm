"use client";

import {
	type MotionValue,
	useMotionValue,
	useMotionValueEvent,
	useScroll,
} from "motion/react";
import { useRef } from "react";
import {
	type HeaderScrollConfig,
	initial_header_scroll_state,
	resolve_header_scroll_state,
} from "./header-scroll-state";

const default_config: HeaderScrollConfig = {
	top_offset: 10,
	hide_tolerance: 24,
	reveal_rate: 3,
};

/** How many px of the header should currently be hidden, as a `MotionValue`
 * driven directly by scroll -- the mobile-browser-chrome model (Android
 * Chrome's address bar), not a pinned/unpinned toggle animated after the
 * fact. `.set()`s outside React's render cycle so scroll sampling never
 * costs a re-render, and reversing scroll direction just reverses the
 * value's slope instead of retargeting a transition -- see
 * `resolve_header_scroll_state` for the hysteresis (sustained downward
 * scroll to hide, any upward scroll reveals fast) that keeps it from
 * chasing the noisy per-frame deltas mobile momentum scrolling produces.
 *
 * `max_hidden` is itself a `MotionValue` (not a plain number) so the caller
 * can keep it in sync with the header's measured, breakpoint-dependent
 * height via `useMotionValue`/`.set()` without forcing a re-subscription
 * here. */
export function useHeaderHiddenAmount(
	max_hidden: MotionValue<number>,
	config: HeaderScrollConfig = default_config,
): MotionValue<number> {
	const { scrollY } = useScroll();
	const hidden = useMotionValue(0);
	const state_ref = useRef(initial_header_scroll_state);
	const last_scroll_y_ref = useRef(0);

	useMotionValueEvent(scrollY, "change", (latest) => {
		const next = resolve_header_scroll_state(
			state_ref.current,
			latest,
			last_scroll_y_ref.current,
			max_hidden.get(),
			config,
		);
		state_ref.current = next;
		last_scroll_y_ref.current = latest;
		hidden.set(next.hidden);
	});

	return hidden;
}
