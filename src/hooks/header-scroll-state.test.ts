import { describe, expect, test } from "vitest";
import {
	type HeaderScrollConfig,
	type HeaderScrollState,
	initial_header_scroll_state,
	resolve_header_scroll_state,
} from "./header-scroll-state";

const max_hidden = 100;
const config: HeaderScrollConfig = {
	top_offset: 10,
	hide_tolerance: 24,
	reveal_rate: 3,
	noise_deadband: 0,
};

function step(
	state: HeaderScrollState,
	last_scroll_y: number,
	scroll_y: number,
) {
	return resolve_header_scroll_state(
		state,
		scroll_y,
		last_scroll_y,
		max_hidden,
		config,
	);
}

describe("resolve_header_scroll_state", () => {
	test("stays fully shown while scrolled distance is below top_offset", () => {
		const result = step(initial_header_scroll_state, 0, 5);
		expect(result).toEqual({ hidden: 0, pending_down: 0 });
	});

	test("small downward scroll below hide_tolerance doesn't hide anything yet", () => {
		const result = step(initial_header_scroll_state, 50, 60);
		expect(result).toEqual({ hidden: 0, pending_down: 10 });
	});

	test("downward scroll past hide_tolerance hides continuously by the excess", () => {
		let state = initial_header_scroll_state;
		state = step(state, 50, 70); // +20, still below 24
		expect(state).toEqual({ hidden: 0, pending_down: 20 });
		state = step(state, 70, 80); // +10 -> pending 30, excess 6 past tolerance
		expect(state).toEqual({ hidden: 6, pending_down: 24 });
	});

	test("hidden amount keeps growing 1:1 once tolerance has been spent", () => {
		let state: HeaderScrollState = { hidden: 6, pending_down: 24 };
		state = step(state, 80, 95); // +15 down, all past tolerance
		expect(state).toEqual({ hidden: 21, pending_down: 24 });
	});

	test("hidden amount clamps at max_hidden under sustained downward scroll", () => {
		let state: HeaderScrollState = { hidden: 6, pending_down: 24 };
		state = step(state, 80, 1000); // huge downward jump
		expect(state).toEqual({ hidden: max_hidden, pending_down: 24 });
	});

	test("any upward scroll immediately starts revealing, faster than 1:1", () => {
		const state: HeaderScrollState = { hidden: 30, pending_down: 24 };
		const result = step(state, 300, 295); // -5 up, reveal_rate 3 -> 15
		expect(result).toEqual({ hidden: 15, pending_down: 0 });
	});

	test("revealing clamps at 0, never going negative", () => {
		const state: HeaderScrollState = { hidden: 5, pending_down: 24 };
		const result = step(state, 300, 290); // -10 up * 3 = 30, well past 5
		expect(result).toEqual({ hidden: 0, pending_down: 0 });
	});

	test("an upward wobble resets pending_down so the next downward run must re-earn tolerance", () => {
		let state = initial_header_scroll_state;
		state = step(state, 50, 65); // +15 down, below tolerance
		expect(state.pending_down).toBe(15);
		state = step(state, 65, 64); // -1 up
		expect(state).toEqual({ hidden: 0, pending_down: 0 });
		state = step(state, 64, 70); // +6 down again, starts from 0
		expect(state).toEqual({ hidden: 0, pending_down: 6 });
	});

	test("scrolling back above top_offset forces fully shown regardless of prior state", () => {
		const hidden_state: HeaderScrollState = { hidden: 80, pending_down: 24 };
		const result = step(hidden_state, 500, 5);
		expect(result).toEqual({ hidden: 0, pending_down: 0 });
	});
});
