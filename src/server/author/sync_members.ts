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

	const members: GoogleMember[] = [];
	const seen_google_ids = new Set<string>();

	// The Admin SDK paginates at up to 200 users per page and signals more
	// results via `nextPageToken` — reading only the first page silently drops
	// anyone past it instead of erroring.
	let page_token: string | undefined;
	do {
		const result = await service.users.list({
			customer: "C049fks0l",
			maxResults: 200,
			pageToken: page_token,
		});

		if (!result.data.users) {
			throw new Error("No Google Admin users found");
		}

		for (const user of result.data.users) {
			// Google Admin's own directory data carries stray leading/trailing
			// whitespace on some real accounts' givenName/familyName (observed
			// in production data) — trimmed here so it doesn't leak into every
			// sync as a double space in the byline or a sort-order glitch.
			const first_name = user.name?.givenName?.trim();
			const last_name = user.name?.familyName?.trim();
			const full_name = user.name?.fullName ?? user.id;
			if (!first_name || !last_name) {
				throw new Error(
					`No given/family name for Google user ${full_name ?? user.id}`,
				);
			}

			const google_id = user.id ?? undefined;
			if (!google_id) throw new Error(`No Google ID for user ${full_name}`);
			if (seen_google_ids.has(google_id)) {
				throw new Error(`Duplicate Google ID for user ${full_name}`);
			}
			seen_google_ids.add(google_id);

			members.push({
				google_id,
				first_name,
				last_name,
				email: user.primaryEmail ?? null,
				image: user.thumbnailPhotoUrl ?? null,
			});
		}

		page_token = result.data.nextPageToken ?? undefined;
	} while (page_token);

	return members;
}

async function fetch_db_members(): Promise<DbMember[]> {
	return db
		.select({
			id: Author.id,
			google_id: Author.google_id,
			first_name: Author.first_name,
			last_name: Author.last_name,
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
						first_name: member.first_name,
						last_name: member.last_name,
						email: member.email,
						image: member.image,
					}) satisfies typeof Author.$inferInsert,
			),
		)
		.onConflictDoUpdate({
			target: Author.google_id,
			set: {
				first_name: sql`excluded.first_name`,
				last_name: sql`excluded.last_name`,
				email: sql`excluded.email`,
				image: sql`excluded.image`,
			},
		})
		.returning();

	apply_server_invalidations("author.synced");

	return result;
}
