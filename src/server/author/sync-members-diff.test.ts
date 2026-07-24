import { describe, expect, test } from "vitest";
import {
	compute_member_sync_diff,
	type DbMember,
	type GoogleMember,
} from "./sync-members-diff";

const google = (overrides: Partial<GoogleMember> = {}): GoogleMember => ({
	google_id: "g1",
	name: "Ana Novak",
	email: "ana@jknm.si",
	image: null,
	...overrides,
});

const db_member = (overrides: Partial<DbMember> = {}): DbMember => ({
	id: 1,
	google_id: "g1",
	name: "Ana Novak",
	email: "ana@jknm.si",
	image: null,
	...overrides,
});

describe("compute_member_sync_diff", () => {
	test("reports no changes when Google and the DB already agree", () => {
		expect(compute_member_sync_diff([google()], [db_member()])).toEqual([]);
	});

	test("reports a new Google member absent from the DB as 'new'", () => {
		const changes = compute_member_sync_diff([google()], []);

		expect(changes).toEqual([{ kind: "new", google: google() }]);
	});

	test("reports a changed field as 'changed', listing only the fields that differ", () => {
		const changes = compute_member_sync_diff(
			[google({ email: "ana.new@jknm.si" })],
			[db_member()],
		);

		expect(changes).toEqual([
			{
				kind: "changed",
				google: google({ email: "ana.new@jknm.si" }),
				before: db_member(),
				diffs: [
					{ field: "email", before: "ana@jknm.si", after: "ana.new@jknm.si" },
				],
			},
		]);
	});

	test("reports a DB member whose google_id is no longer in the Google list as 'missing'", () => {
		const changes = compute_member_sync_diff([], [db_member()]);

		expect(changes).toEqual([{ kind: "missing", before: db_member() }]);
	});

	test("ignores DB rows with no google_id (guests)", () => {
		const guest = db_member({ id: 2, google_id: null, name: "Guest" });

		expect(compute_member_sync_diff([], [guest])).toEqual([]);
	});

	test("matches by google_id, not by row order", () => {
		const changes = compute_member_sync_diff(
			[google({ google_id: "g2", name: "Bor Kos" })],
			[
				db_member({ google_id: "g1" }),
				db_member({ id: 2, google_id: "g2", name: "Bor Kos" }),
			],
		);

		expect(changes).toEqual([
			{ kind: "missing", before: db_member({ google_id: "g1" }) },
		]);
	});
});
