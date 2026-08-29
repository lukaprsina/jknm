export interface HeaderScrollConfig {
	/** Below this scroll offset the header is always fully shown -- guards
	 * against a rubber-band bounce at the very top hiding it before the user
	 * has scrolled at all. */
	top_offset: number;
	/** Downward scroll, accumulated since the last upward movement, that
	 * must be spent before the header starts hiding -- headroom.js's "down
	 * tolerance", so a small downward wobble doesn't nibble at it. */
	hide_tolerance: number;
	/** Multiplier applied to upward scroll when pulling the header back into
	 * view. >1 makes revealing faster than the raw scroll distance, matching
	 * how a mobile browser's own address bar snaps back on the first sign of
	 * upward intent while resisting on the way down. */
	reveal_rate: number;
}

export interface HeaderScrollState {
	/** How many px of the header are currently hidden, in `[0, max_hidden]`.
	 * Moves continuously with scroll, unlike a pinned/unpinned boolean --
	 * that's what makes this safe to read every scroll sample without ever
	 * needing to interrupt an in-flight transition. */
	hidden: number;
	/** Downward scroll not yet past `hide_tolerance`, reset by any upward
	 * movement. */
	pending_down: number;
}

export const initial_header_scroll_state: HeaderScrollState = {
	hidden: 0,
	pending_down: 0,
};

export function clamp(value: number, min: number, max: number): number {
	if (value < min) return min;
	if (value > max) return max;
	return value;
}

/** Headroom-style tolerance, expressed as a continuous accumulator instead
 * of a discrete pinned/unpinned toggle -- `hidden` is a direct function of
 * scroll delta, so reversing scroll direction just reverses its slope
 * rather than retargeting a transition. Framework-agnostic (no DOM, no
 * `motion`) so this is unit-testable without a browser. */
export function resolve_header_scroll_state(
	state: HeaderScrollState,
	scroll_y: number,
	last_scroll_y: number,
	max_hidden: number,
	config: HeaderScrollConfig,
): HeaderScrollState {
	if (scroll_y < config.top_offset) {
		return { hidden: 0, pending_down: 0 };
	}

	const diff = scroll_y - last_scroll_y;

	if (diff <= 0) {
		const revealed = -diff * config.reveal_rate;
		return {
			hidden: clamp(state.hidden - revealed, 0, max_hidden),
			pending_down: 0,
		};
	}

	const pending_down = state.pending_down + diff;
	if (pending_down <= config.hide_tolerance) {
		return { hidden: state.hidden, pending_down };
	}

	const excess = pending_down - config.hide_tolerance;
	return {
		hidden: clamp(state.hidden + excess, 0, max_hidden),
		pending_down: config.hide_tolerance,
	};
}
