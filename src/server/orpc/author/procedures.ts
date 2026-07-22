import { delete_guests } from "~/server/author/delete";
import { insert_guest } from "~/server/author/insert";
import { rename_guest } from "~/server/author/rename";
import {
	sync_members,
	sync_members_validator,
} from "~/server/author/sync_members";
import {
	delete_guests_validator,
	insert_guest_validator,
	rename_guest_validator,
} from "~/server/author/validator";
import { authed } from "../base";

/**
 * Thin oRPC wrappers around the author actions — see
 * src/server/orpc/article/procedures.ts for the same rationale.
 *
 * No Seam 3 smoke test for this module: importing it pulls in
 * `sync_members.ts`'s `googleapis` import, which throws under Vitest's node
 * environment (`buffer-equal-constant-time`/`jwa`), a pre-existing library
 * incompatibility unrelated to this file. The article-domain smoke tests
 * (`~/server/orpc/article/procedures.test.ts`) cover the same `authed`/
 * `.input()` wiring this module shares.
 */

export const insertGuest = authed
	.input(insert_guest_validator)
	.handler(async ({ input }) => insert_guest(input));

export const renameGuest = authed
	.input(rename_guest_validator)
	.handler(async ({ input }) => rename_guest(input));

export const deleteGuests = authed
	.input(delete_guests_validator)
	.handler(async ({ input }) => delete_guests(input));

export const syncMembers = authed
	.input(sync_members_validator)
	.handler(async ({ input }) => sync_members(input));

export const authorRouter = {
	insertGuest,
	renameGuest,
	deleteGuests,
	syncMembers,
};
