"use server";

import { ORPCError } from "@orpc/server";
import {
	archive_article,
	create_superseding_draft,
	delete_article,
	discard_draft,
} from "~/server/article/lifecycle";
import {
	create_article,
	publish_article,
	save_article,
} from "~/server/article/new-article";
import {
	preview_algolia_sync,
	sync_algolia,
} from "~/server/article/sync-algolia";
import {
	archive_article_validator,
	create_article_validator,
	create_superseding_draft_validator,
	delete_article_validator,
	discard_draft_validator,
	publish_article_validator,
	save_article_validator,
} from "~/server/article/validators";
import { actionableOptions, authed } from "../base";

/**
 * Thin oRPC wrappers around the article lifecycle/new-article actions: auth
 * + input validation live here, business logic stays in `~/server/article/*`
 * unchanged (ADR-0002's "framework-agnostic modules don't become procedures").
 *
 * `.actionable(actionableOptions)` makes each export a real Next.js Server
 * Action, callable directly from client components — required because
 * `apply_server_invalidations`'s `updateTag` only works inside a genuine
 * Server Action, not the `/api/orpc` Route Handler (see #31 live-bug fix).
 */

export const createArticle = authed
	.input(create_article_validator)
	.handler(async ({ input, context }) => create_article(input, context.session))
	.actionable(actionableOptions);

export const saveArticle = authed
	.input(save_article_validator)
	.handler(async ({ input }) => save_article(input))
	.actionable(actionableOptions);

export const publishArticle = authed
	.input(publish_article_validator)
	.handler(async ({ input }) => publish_article(input))
	.actionable(actionableOptions);

export const archiveArticle = authed
	.input(archive_article_validator)
	.handler(async ({ input }) => archive_article(input))
	.actionable(actionableOptions);

export const deleteArticle = authed
	.input(delete_article_validator)
	.handler(async ({ input }) => delete_article(input))
	.actionable(actionableOptions);

export const discardDraft = authed
	.input(discard_draft_validator)
	.handler(async ({ input }) => discard_draft(input))
	.actionable(actionableOptions);

export const createSupersedingDraft = authed
	.input(create_superseding_draft_validator)
	.handler(async ({ input, context }) =>
		create_superseding_draft(input, context.session),
	)
	.actionable(actionableOptions);

/**
 * oRPC masks every thrown error into a generic "Internal Server Error"
 * before it reaches the client (see `toORPCError` in `@orpc/client`) — so
 * without this, a real cause (Algolia credentials, a browse failure) is both
 * invisible to the admin and never logged anywhere. Logging here and
 * rethrowing with the original message preserved keeps that cause visible on
 * both sides. Mirrors `rethrow_logged` in `~/server/orpc/author/procedures.ts`.
 */
function rethrow_logged(context: string, error: unknown): never {
	console.error(`[${context}]`, error);
	throw new ORPCError("INTERNAL_SERVER_ERROR", {
		message: error instanceof Error ? error.message : String(error),
	});
}

export const previewAlgoliaSync = authed
	.handler(async () => {
		try {
			return await preview_algolia_sync();
		} catch (error) {
			rethrow_logged("previewAlgoliaSync", error);
		}
	})
	.actionable(actionableOptions);

export const syncAlgolia = authed
	.handler(async () => {
		try {
			return await sync_algolia();
		} catch (error) {
			rethrow_logged("syncAlgolia", error);
		}
	})
	.actionable(actionableOptions);
