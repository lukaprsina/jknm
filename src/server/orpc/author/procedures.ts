"use server";

import { delete_guests } from "~/server/author/delete";
import { insert_guest } from "~/server/author/insert";
import { rename_guest } from "~/server/author/rename";
import {
	delete_guests_validator,
	insert_guest_validator,
	rename_guest_validator,
} from "~/server/author/validator";
import { actionableOptions, authed } from "../base";

/**
 * Thin oRPC wrappers around the author actions — see
 * src/server/orpc/article/procedures.ts for the same `.actionable()`
 * rationale (real Server Actions, required by `updateTag`).
 *
 * `previewMemberSync`/`syncMembers` dynamic-import `sync_members.ts` inside
 * their handlers instead of importing it at module scope like the others:
 * that file imports `googleapis` (via `google-auth-library`), which throws
 * at *import* evaluation time — not just when called — under Vitest's node
 * environment (`buffer-equal-constant-time`/`jwa`), a pre-existing library
 * incompatibility (Node 26 dropped `Buffer.SlowBuffer`, which that package
 * still reaches for). Deferring the import confines the crash to these two
 * procedures, which never run under Vitest.
 *
 * No Seam 3 smoke test for these two procedures for the same reason: calling
 * them would still throw under Vitest. The article-domain smoke tests
 * (`~/server/orpc/article/procedures.test.ts`) cover the same `authed`
 * wiring this module shares.
 */

export const insertGuest = authed
	.input(insert_guest_validator)
	.handler(async ({ input }) => insert_guest(input))
	.actionable(actionableOptions);

export const renameGuest = authed
	.input(rename_guest_validator)
	.handler(async ({ input }) => rename_guest(input))
	.actionable(actionableOptions);

export const deleteGuests = authed
	.input(delete_guests_validator)
	.handler(async ({ input }) => delete_guests(input))
	.actionable(actionableOptions);

export const previewMemberSync = authed
	.handler(async () => {
		const { preview_member_sync } = await import(
			"~/server/author/sync_members"
		);
		return preview_member_sync();
	})
	.actionable(actionableOptions);

export const syncMembers = authed
	.handler(async () => {
		const { sync_members } = await import("~/server/author/sync_members");
		return sync_members();
	})
	.actionable(actionableOptions);
