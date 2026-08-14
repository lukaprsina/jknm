/**
 * Pure diff between Google Workspace's member list and the DB's current
 * `member`-type Author rows. No I/O — `sync_members.ts` supplies both sides
 * (fetched from Google, read from the DB) so this stays trivially testable.
 */

export interface GoogleMember {
	google_id: string;
	first_name: string;
	last_name: string;
	email: string | null;
	image: string | null;
}

export interface DbMember {
	id: number;
	google_id: string | null;
	first_name: string;
	last_name: string;
	email: string | null;
	image: string | null;
}

export interface MemberFieldDiff {
	field: "first_name" | "last_name" | "email" | "image";
	before: string | null;
	after: string | null;
}

export type MemberSyncChange =
	| { kind: "new"; google: GoogleMember }
	| {
			kind: "changed";
			google: GoogleMember;
			before: DbMember;
			diffs: MemberFieldDiff[];
	  }
	| { kind: "missing"; before: DbMember };

function diff_fields(before: DbMember, after: GoogleMember): MemberFieldDiff[] {
	const diffs: MemberFieldDiff[] = [];

	if (before.first_name !== after.first_name) {
		diffs.push({
			field: "first_name",
			before: before.first_name,
			after: after.first_name,
		});
	}
	if (before.last_name !== after.last_name) {
		diffs.push({
			field: "last_name",
			before: before.last_name,
			after: after.last_name,
		});
	}
	if (before.email !== after.email) {
		diffs.push({ field: "email", before: before.email, after: after.email });
	}
	if (before.image !== after.image) {
		diffs.push({ field: "image", before: before.image, after: after.image });
	}

	return diffs;
}

export function compute_member_sync_diff(
	google_members: GoogleMember[],
	db_members: DbMember[],
): MemberSyncChange[] {
	const db_by_google_id = new Map(
		db_members
			.map((member) => [member.google_id, member] as const)
			.filter((pair): pair is [string, DbMember] => pair[0] !== null),
	);
	const google_ids = new Set(google_members.map((member) => member.google_id));
	const changes: MemberSyncChange[] = [];

	for (const google of google_members) {
		const existing = db_by_google_id.get(google.google_id);
		if (!existing) {
			changes.push({ kind: "new", google });
			continue;
		}

		const diffs = diff_fields(existing, google);
		if (diffs.length > 0) {
			changes.push({ kind: "changed", google, before: existing, diffs });
		}
	}

	for (const db_member of db_members) {
		if (db_member.google_id !== null && !google_ids.has(db_member.google_id)) {
			changes.push({ kind: "missing", before: db_member });
		}
	}

	return changes;
}
