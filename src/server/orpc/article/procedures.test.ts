import { call, ORPCError } from "@orpc/server";
import { describe, expect, test } from "vitest";
import type { Session } from "~/server/auth";
import { archiveArticle } from "./procedures";

/**
 * Seam 3 (issue #31): oRPC procedures are directly callable server-side, so
 * these assert wiring only — an unauthenticated call is rejected, and
 * malformed input is rejected before the handler (and therefore business
 * logic) ever runs. Lifecycle/validation *behavior* is tested at Seam 2
 * (lifecycle-rules.test.ts, article-queries.test.ts), not here.
 *
 * The author domain (`~/server/orpc/author/procedures`) has no equivalent
 * smoke test: it imports `sync_members.ts`, which imports `googleapis` at
 * module scope, and `googleapis` throws (`buffer-equal-constant-time`/`jwa`)
 * when loaded under Vitest's node environment — a pre-existing library
 * incompatibility, not something this diff introduced or should paper over.
 * These two assertions exercise the same `authed`/`.input()` wiring both
 * domains share, so this is coverage of the pattern, not of `archiveArticle`
 * specifically.
 */

const fake_session: Session = {
	user: { id: "user-1", name: "Test User", email: null, image: null },
	expires: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
};

describe("archiveArticle", () => {
	test("rejects an unauthenticated call", async () => {
		await expect(
			call(
				archiveArticle,
				{ article_id: "1a2b3c4d-1a2b-1a2b-1a2b-1a2b3c4d5e6f" },
				{ context: { session: null } },
			),
		).rejects.toThrow(ORPCError);
	});

	test("rejects malformed input before reaching business logic", async () => {
		await expect(
			call(
				archiveArticle,
				{ article_id: "not-a-uuid" },
				{ context: { session: fake_session } },
			),
		).rejects.toThrow();
	});
});
