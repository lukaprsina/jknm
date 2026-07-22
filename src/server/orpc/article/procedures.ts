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
import { authed } from "../base";

/**
 * Thin oRPC wrappers around the article lifecycle/new-article actions: auth
 * + input validation live here, business logic stays in `~/server/article/*`
 * unchanged (ADR-0002's "framework-agnostic modules don't become procedures").
 */

export const createArticle = authed
	.input(create_article_validator)
	.handler(async ({ input }) => create_article(input));

export const saveArticle = authed
	.input(save_article_validator)
	.handler(async ({ input }) => save_article(input));

export const publishArticle = authed
	.input(publish_article_validator)
	.handler(async ({ input }) => publish_article(input));

export const archiveArticle = authed
	.input(archive_article_validator)
	.handler(async ({ input }) => archive_article(input));

export const deleteArticle = authed
	.input(delete_article_validator)
	.handler(async ({ input }) => delete_article(input));

export const discardDraft = authed
	.input(discard_draft_validator)
	.handler(async ({ input }) => discard_draft(input));

export const createSupersedingDraft = authed
	.input(create_superseding_draft_validator)
	.handler(async ({ input }) => create_superseding_draft(input));

export const articleRouter = {
	create: createArticle,
	save: saveArticle,
	publish: publishArticle,
	archive: archiveArticle,
	delete: deleteArticle,
	discardDraft,
	createSupersedingDraft,
};
