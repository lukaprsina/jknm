"use server";

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
