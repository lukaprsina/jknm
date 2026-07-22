"use server";

import { delete_guests } from "~/server/author/delete";
import { insert_guest } from "~/server/author/insert";
import { rename_guest } from "~/server/author/rename";
import {
	delete_guests_validator,
	insert_guest_validator,
	rename_guest_validator,
	sync_members_validator,
} from "~/server/author/validator";
import { actionableOptions, authed } from "../base";

/**
 * Thin oRPC wrappers around the author actions — see
 * src/server/orpc/article/procedures.ts for the same `.actionable()`
 * rationale (real Server Actions, required by `updateTag`).
 *
 * `syncMembers` dynamic-imports `sync_members.ts` inside its handler instead
 * of importing it at module scope like the others: that file imports
 * `googleapis` (via `google-auth-library`), which has thrown at *import*
 * evaluation time — not just when called — under Vitest's node environment
 * (`buffer-equal-constant-time`/`jwa`), a pre-existing library
 * incompatibility. Deferring the import confines any crash to `syncMembers`
 * itself, which is what actually needs fixing (tracked separately — it's
 * marked `// TODO` in `sync_members.ts`). `syncMembers` has no wired UI call
 * site yet, so this is precautionary.
 *
 * No Seam 3 smoke test for this procedure for the same reason: calling it
 * would still throw. The article-domain smoke tests
 * (`~/server/orpc/article/procedures.test.ts`) cover the same `authed`/
 * `.input()` wiring this module shares.
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

export const syncMembers = authed
	.input(sync_members_validator)
	.handler(async ({ input }) => {
		const { sync_members } = await import("~/server/author/sync_members");
		return sync_members(input);
	})
	.actionable(actionableOptions);
