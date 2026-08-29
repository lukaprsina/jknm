"use client";

import {
	type MotionValue,
	useMotionValue,
	useMotionValueEvent,
	useScroll,
} from "motion/react";
import { useEffect, useRef } from "react";
import {
	type HeaderScrollConfig,
	initial_header_scroll_state,
	resolve_header_scroll_state,
} from "./header-scroll-state";

const default_config: HeaderScrollConfig = {
	top_offset: 10,
	hide_tolerance: 24,
	reveal_rate: 3,
	noise_deadband: 6,
};

/** How many px of the header should currently be hidden, as a `MotionValue`
 * driven directly by scroll -- the mobile-browser-chrome model (Android
 * Chrome's address bar), not a pinned/unpinned toggle animated after the
 * fact. `.set()`s outside React's render cycle so scroll sampling never
 * costs a re-render. See `resolve_header_scroll_state` for the hysteresis.
 *
 * `max_hidden` is a `MotionValue` rather than a plain number so the caller
 * can keep it in sync with the header's measured, breakpoint-dependent
 * height without forcing a re-subscription here. */
export function useHeaderHiddenAmount(
	max_hidden: MotionValue<number>,
	config: HeaderScrollConfig = default_config,
): MotionValue<number> {
	const { scrollY } = useScroll();
	const hidden = useMotionValue(0);
	const state_ref = useRef(initial_header_scroll_state);
	const last_scroll_y_ref = useRef(0);
	const pending_scroll_y_ref = useRef(0);
	const raf_id_ref = useRef<number | undefined>(undefined);
	const has_baseline_ref = useRef(false);

	// `scroll` events can fire far more often than the display refreshes,
	// especially during touch momentum scrolling. Recording only the latest
	// value and doing the hysteresis + DOM write in a single rAF callback
	// caps the real work at once per frame.
	useMotionValueEvent(scrollY, "change", (latest) => {
		pending_scroll_y_ref.current = latest;
		if (raf_id_ref.current !== undefined) return;

		raf_id_ref.current = requestAnimationFrame(() => {
			raf_id_ref.current = undefined;

			// The first sample after mount only sets the baseline, it isn't run
			// through hysteresis: on reload the browser can restore a scrolled
			// position after mount, and treating that jump as a fast downward
			// scroll would snap the header straight to hidden.
			if (!has_baseline_ref.current) {
				has_baseline_ref.current = true;
				last_scroll_y_ref.current = pending_scroll_y_ref.current;
				return;
			}

			const next = resolve_header_scroll_state(
				state_ref.current,
				pending_scroll_y_ref.current,
				last_scroll_y_ref.current,
				max_hidden.get(),
				config,
			);
			state_ref.current = next;
			last_scroll_y_ref.current = pending_scroll_y_ref.current;
			hidden.set(next.hidden);
		});
	});

	useEffect(() => {
		return () => {
			if (raf_id_ref.current !== undefined) {
				cancelAnimationFrame(raf_id_ref.current);
			}
		};
	}, []);

	return hidden;
}
