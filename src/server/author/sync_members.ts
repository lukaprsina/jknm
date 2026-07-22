import { eq, sql } from "drizzle-orm";
import type { JWTInput } from "google-auth-library";
import { google } from "googleapis";
import { env } from "~/env";
import { apply_server_invalidations } from "../cache-invalidation";
import { db } from "../db";
import { Author } from "../db/schema";
import {
	compute_member_sync_diff,
	type DbMember,
	type GoogleMember,
	type MemberSyncChange,
} from "./sync-members-diff";

async function fetch_google_members(): Promise<GoogleMember[]> {
	const credentials = env.JKNM_SERVICE_ACCOUNT_CREDENTIALS;
	if (!credentials) {
		throw new Error("No credentials for Google Admin found");
	}

	const credentials_text = atob(credentials);
	const credentials_json = JSON.parse(credentials_text) as Partial<JWTInput>;
	const google_client = await google.auth.getClient({
		credentials: credentials_json,
		scopes: ["https://www.googleapis.com/auth/admin.directory.user.readonly"],
	});

	const service = google.admin({
		version: "directory_v1",
		auth: google_client,
	});

	const result = await service.users.list({
		customer: "C049fks0l",
	});

	if (!result.data.users) {
		throw new Error("No Google Admin users found");
	}

	const members: GoogleMember[] = [];
	const seen_google_ids = new Set<string>();

	for (const user of result.data.users) {
		const name = user.name?.fullName;
		if (!name) throw new Error(`No full name for Google user ${user.id}`);

		const google_id = user.id ?? undefined;
		if (!google_id) throw new Error(`No Google ID for user ${name}`);
		if (seen_google_ids.has(google_id)) {
			throw new Error(`Duplicate Google ID for user ${name}`);
		}
		seen_google_ids.add(google_id);

		members.push({
			google_id,
			name,
			email: user.primaryEmail ?? null,
			image: user.thumbnailPhotoUrl ?? null,
		});
	}

	return members;
}

async function fetch_db_members(): Promise<DbMember[]> {
	return db
		.select({
			id: Author.id,
			google_id: Author.google_id,
			name: Author.name,
			email: Author.email,
			image: Author.image,
		})
		.from(Author)
		.where(eq(Author.author_type, "member"));
}

/**
 * Read-only: fetches the current Google Workspace member list and diffs it
 * against the DB, for the admin dialog's sanity-check view. Never writes.
 */
export async function preview_member_sync(): Promise<MemberSyncChange[]> {
	const [google_members, db_members] = await Promise.all([
		fetch_google_members(),
		fetch_db_members(),
	]);

	return compute_member_sync_diff(google_members, db_members);
}

/**
 * Re-fetches Google Workspace itself rather than trusting a client-supplied
 * preview, then upserts every member keyed on `google_id`
 * (author_google_id_idx). Members whose google_id has disappeared from
 * Google (`missing` in the diff) are left untouched — Google marks departed
 * accounts `suspended` rather than removing them, so this DB has never
 * actually seen a real removal.
 */
export async function sync_members() {
	const google_members = await fetch_google_members();

	const result = await db
		.insert(Author)
		.values(
			google_members.map(
				(member) =>
					({
						author_type: "member",
						google_id: member.google_id,
						name: member.name,
						email: member.email,
						image: member.image,
					}) satisfies typeof Author.$inferInsert,
			),
		)
		.onConflictDoUpdate({
			target: Author.google_id,
			set: {
				name: sql`excluded.name`,
				email: sql`excluded.email`,
				image: sql`excluded.image`,
			},
		})
		.returning();

	apply_server_invalidations("author.synced");

	return result;
}
