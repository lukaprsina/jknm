import { and, eq, ne, sql } from "drizzle-orm";
import type { z } from "zod";
import { convert_new_article_to_algolia_object } from "~/lib/algoliasearch";
import { convert_title_to_url } from "~/lib/article-utils";
import { assert_one } from "~/lib/assert-length";
import type { ThumbnailType } from "~/lib/validators";
import type { Session } from "../auth";
import { apply_server_invalidations } from "../cache-invalidation";
import { type DbTransaction, db } from "../db";
import { Article, ArticleSlug, ArticlesToAuthors, Media } from "../db/schema";
import { find_article_with_relations } from "./article-queries";
import {
	add_or_update_algolia,
	remove_from_algolia,
	soft_delete_article,
} from "./lifecycle";
import {
	assert_can_supersede,
	decide_published_at,
	decide_slug_transition,
	is_supersede_publish,
} from "./lifecycle-rules";
import { reconcile_media_to_articles } from "./reconcile-media";
import { find_available_slug } from "./slug";
import type {
	create_article_validator,
	publish_article_validator,
	save_article_validator,
} from "./validators";

/**
 * Generate a slug for a newly-titled article, deriving the base from the
 * title and delegating collision-suffixing to `find_available_slug`. Runs
 * inside the publish transaction to avoid a race.
 */
async function generate_unique_article_slug(tx: DbTransaction, title: string) {
	return find_available_slug(tx, convert_title_to_url(title));
}

async function resolve_first_publish_slug(
	tx: DbTransaction,
	article_id: string,
	title: string,
) {
	const existing_primary = await tx.query.ArticleSlug.findFirst({
		where: and(
			eq(ArticleSlug.article_id, article_id),
			eq(ArticleSlug.is_primary, true),
		),
	});
	if (existing_primary) return existing_primary;

	const slug = await generate_unique_article_slug(tx, title);
	const inserted = await tx
		.insert(ArticleSlug)
		.values({ slug, article_id, is_primary: true })
		.returning();
	assert_one(inserted);
	return inserted[0];
}

/**
 * Supersede-publish's slug rule (#21): if the superseded article's title is
 * unchanged, its primary slug is inherited (re-pointed to the newly
 * published row, same slug text). If retitled, a new primary slug is minted
 * for the new row and the old one is demoted to non-primary — kept,
 * resolvable, not deleted. Also retires the superseded row via the shared
 * `soft_delete_article`.
 *
 * `legacy_id` moves separately, in `inherit_identity_from_source` — it has to
 * happen on the archived-source path too, which never reaches this function.
 *
 * A `content`-kind source is always treated as "title unchanged" here — same
 * fixed-route guarantee `resolve_retitle_slug` gates on plain saves (#35),
 * applied to the supersede-publish path too since editing a content page
 * normally goes through a superseding draft, not a plain save.
 */
async function resolve_supersede_publish_slug(
	tx: DbTransaction,
	article_id: string,
	supersedes_id: string,
	new_title: string,
) {
	// Lock the superseded row so two concurrent supersede-publishes of the
	// same source (e.g. two superseding drafts opened from the same archived
	// article in separate tabs) serialize instead of racing on its primary
	// slug: the second transaction blocks here until the first commits, then
	// sees `status: "deleted"` and fails `assert_can_supersede` cleanly
	// instead of overwriting the winner's slug re-point.
	const superseded_rows = await tx
		.select({
			id: Article.id,
			title: Article.title,
			status: Article.status,
			article_kind: Article.article_kind,
		})
		.from(Article)
		.where(eq(Article.id, supersedes_id))
		.for("update");
	const superseded = superseded_rows[0];
	if (!superseded) throw new Error("Superseded article not found");
	assert_can_supersede(superseded.status);

	const old_primary_slug =
		(await tx.query.ArticleSlug.findFirst({
			where: and(
				eq(ArticleSlug.article_id, supersedes_id),
				eq(ArticleSlug.is_primary, true),
			),
		})) ?? null;

	// A content-kind row's slug never reminits on retitle (see this
	// function's doc comment and #35) — same rule as `resolve_retitle_slug`,
	// applied here by feeding `decide_slug_transition` its own old title so
	// it always takes the "reuse" branch, re-pointing the existing slug to
	// the newly-published row without ever minting a new one.
	const decision = decide_slug_transition({
		old_title: superseded.title,
		new_title:
			superseded.article_kind === "content" ? superseded.title : new_title,
		old_primary_slug,
	});

	let primary: typeof ArticleSlug.$inferSelect;

	if (decision.action === "reuse") {
		const updated = await tx
			.update(ArticleSlug)
			.set({ article_id })
			.where(eq(ArticleSlug.id, decision.slug_id))
			.returning();
		assert_one(updated);
		primary = updated[0];
	} else {
		if (decision.action === "mint_new_and_demote") {
			// Re-point to the new (now-published) article, same as `reuse` —
			// the superseded row is about to be soft-deleted (invisible to
			// everyone), so the demoted slug must follow the content to stay
			// "resolvable, not 404ing" as required by #21.
			await tx
				.update(ArticleSlug)
				.set({ is_primary: false, article_id })
				.where(eq(ArticleSlug.id, decision.demote_slug_id));
		}

		const slug = await generate_unique_article_slug(tx, new_title);
		const inserted = await tx
			.insert(ArticleSlug)
			.values({ slug, article_id, is_primary: true })
			.returning();
		assert_one(inserted);
		primary = inserted[0];
	}

	// Any other slug the superseded article picked up over its history (from
	// an earlier retitle of *this same lineage*) needs to move forward too,
	// not just the primary — otherwise it's left attached to a row this call
	// is about to soft-delete, and a later retitle of the new row stops
	// resolving it (the bug #21's "kept, resolvable, not deleted" guarantee
	// was meant to prevent). The primary/demoted slug above is already
	// re-pointed, so this only ever touches the rest.
	await tx
		.update(ArticleSlug)
		.set({ is_primary: false, article_id })
		.where(
			and(
				eq(ArticleSlug.article_id, supersedes_id),
				ne(ArticleSlug.id, primary.id),
			),
		);

	await soft_delete_article(tx, supersedes_id);

	// Unlisting is a network call, so it's deferred to the caller to run
	// *after* the transaction commits, rather than while this function's
	// `FOR UPDATE` lock (above) is still held.
	return {
		primary,
		unlist_algolia_id: superseded.status === "published" ? supersedes_id : null,
	};
}

/**
 * Move `legacy_id` off the superseded row and onto the newly published one.
 *
 * `legacy_id` is the same kind of fact as the primary slug — how an inbound
 * link from the old 2008 site (`/si/?id=<legacy_id>`, resolved by
 * src/app/si/route.ts and `resolve_legacy_article_link`) finds this article
 * today — so it has to follow the content forward. Left on a superseded row,
 * which is always soft-deleted, every such link resolves to an article nobody
 * can see.
 *
 * Deliberately keyed on "this draft supersedes something", *not* on
 * `is_supersede_publish`: unarchiving retires the source immediately
 * (`create_superseding_draft`), so on that path the source is already
 * `deleted` at publish time and the slug function below never runs — but the
 * new row is still the same article and still needs the id. Runs after the
 * slug work so the `FOR UPDATE` lock taken there (still held, same
 * transaction) also covers this write on the supersede-publish path.
 */
async function inherit_identity_from_source(
	tx: DbTransaction,
	article_id: string,
	supersedes_id: string,
) {
	const source_rows = await tx
		.select({ legacy_id: Article.legacy_id })
		.from(Article)
		.where(eq(Article.id, supersedes_id))
		.for("update");
	const source = source_rows[0];
	if (source?.legacy_id == null) return;

	// Unique column, so the source releases the value before the new row takes it.
	await tx
		.update(Article)
		.set({ legacy_id: null })
		.where(eq(Article.id, supersedes_id));
	await tx
		.update(Article)
		.set({ legacy_id: source.legacy_id })
		.where(eq(Article.id, article_id));
}

/**
 * Resolve a thumbnail crop (which references a media URL) into the new
 * schema's `thumbnail_media_id` + percentage columns. Media that isn't found
 * (e.g. an external URL) clears the thumbnail.
 */
async function resolve_thumbnail(
	tx: DbTransaction,
	thumbnail_crop: ThumbnailType | undefined,
) {
	const cleared = {
		thumbnail_media_id: null,
		thumbnail_x: null,
		thumbnail_y: null,
		thumbnail_width: null,
		thumbnail_height: null,
		uploaded_custom_thumbnail: null,
	};

	if (!thumbnail_crop) return cleared;

	const media = await tx
		.select({ id: Media.id })
		.from(Media)
		.where(sql`${Media.original}->>'url' = ${thumbnail_crop.image_url}`)
		.limit(1);

	const media_id = media.at(0)?.id;
	if (!media_id) return cleared;

	return {
		thumbnail_media_id: media_id,
		thumbnail_x: thumbnail_crop.x,
		thumbnail_y: thumbnail_crop.y,
		thumbnail_width: thumbnail_crop.width,
		thumbnail_height: thumbnail_crop.height,
		uploaded_custom_thumbnail: thumbnail_crop.uploaded_custom_thumbnail ?? null,
	};
}

async function replace_article_authors(
	tx: DbTransaction,
	article_id: string,
	author_ids: number[],
) {
	await tx
		.delete(ArticlesToAuthors)
		.where(eq(ArticlesToAuthors.article_id, article_id));

	if (author_ids.length !== 0) {
		await tx.insert(ArticlesToAuthors).values(
			author_ids.map((author_id, index) => ({
				article_id,
				author_id,
				order: index,
			})),
		);
	}
}

/**
 * Create a fresh draft on the unified `articles` table. This is the new-table
 * equivalent of `create_draft`'s title-only branch — no S3 involvement, media
 * is uploaded separately (#18).
 */
export async function create_article(
	input: z.infer<typeof create_article_validator>,
	session: Session,
) {
	const created_articles = await db
		.insert(Article)
		.values({
			title: input.title,
			status: "draft",
			content_json: {
				blocks: [
					{
						id: "sheNwCUP5A",
						type: "header",
						data: {
							text: input.title,
							level: 1,
						},
					},
				],
			},
			created_by: session.user.id,
		})
		.returning();

	assert_one(created_articles);
	const created_article = created_articles[0];

	apply_server_invalidations("article.created");
	return created_article;
}

/**
 * A plain save's counterpart to `resolve_supersede_publish_slug`'s
 * retitle rule (#21): a published article's title changed under it (not via
 * a supersede-draft), so mint a fresh slug and demote the old one to
 * non-primary — kept, resolvable, not deleted — rather than leaving the
 * primary slug (and every inbound legacy `/si/?id=<legacy_id>` link) pointing
 * at URL text that no longer matches the title. Draft saves never reach this
 * (see call site): a draft has no public URL yet, so there's nothing to keep
 * in sync until publish. `content`-kind rows never reach this either (gated
 * at the call site): their route is the fixed page, not the slug, so
 * reminting on a heading edit would silently break it (#33).
 */
async function resolve_retitle_slug(
	tx: DbTransaction,
	article_id: string,
	old_title: string,
	new_title: string,
) {
	const old_primary_slug =
		(await tx.query.ArticleSlug.findFirst({
			where: and(
				eq(ArticleSlug.article_id, article_id),
				eq(ArticleSlug.is_primary, true),
			),
		})) ?? null;

	const decision = decide_slug_transition({
		old_title,
		new_title,
		old_primary_slug,
	});
	if (decision.action === "reuse") return;

	if (decision.action === "mint_new_and_demote") {
		await tx
			.update(ArticleSlug)
			.set({ is_primary: false })
			.where(eq(ArticleSlug.id, decision.demote_slug_id));
	}

	const slug = await generate_unique_article_slug(tx, new_title);
	await tx.insert(ArticleSlug).values({ slug, article_id, is_primary: true });
}

/**
 * Save a draft on the unified `articles` table: update the row, replace its
 * authors, and reconcile `media_to_articles` from the content (#19).
 *
 * `input.article.published_at` (the settings-form date picker's value) is
 * deliberately not written here: a draft has no real publish date yet, and
 * writing one into the `published_at` column early would make
 * `get_archive_origin_label` misreport a still-`draft` row that gets archived
 * directly (`draft` -> `archived` is allowed) as "was published". The picked
 * date only takes effect at actual publish time, via `decide_published_at`'s
 * `requested` param in `publish_article` below.
 */
export async function save_article(
	input: z.infer<typeof save_article_validator>,
) {
	const transaction = await db.transaction(async (tx) => {
		const existing = await tx.query.Article.findFirst({
			where: eq(Article.id, input.article_id),
			columns: { title: true, status: true, article_kind: true },
		});
		if (!existing) throw new Error("Article not found");

		const thumbnail = await resolve_thumbnail(tx, input.article.thumbnail_crop);

		const updated = await tx
			.update(Article)
			.set({
				title: input.article.title,
				content_json: input.article.content ?? undefined,
				...thumbnail,
			})
			.where(eq(Article.id, input.article_id))
			.returning();

		assert_one(updated);

		await replace_article_authors(tx, input.article_id, input.author_ids);
		// Reconcile against the *persisted* content, not the input: the update
		// above preserves the stored content when `input.article.content` is
		// omitted, so keying reconcile off the input would wipe every media link
		// on a content-less save.
		await reconcile_media_to_articles(
			tx,
			input.article_id,
			updated[0].content_json,
		);

		if (
			existing.status === "published" &&
			existing.article_kind !== "content" &&
			existing.title !== input.article.title
		) {
			await resolve_retitle_slug(
				tx,
				input.article_id,
				existing.title,
				input.article.title,
			);
		}

		return find_article_with_relations(tx, eq(Article.id, input.article_id));
	});

	apply_server_invalidations("article.saved");
	return transaction;
}

/**
 * Publish a draft on the unified `articles` table: flip status to
 * `published`, assign a primary slug, reconcile media/authors, and push to
 * Algolia. Handles both first-publish (#20, no `supersedes_id`) and
 * supersede-publish (#21, `supersedes_id` set): the latter also retires the
 * superseded row and applies the slug-inherit-or-demote rule — see
 * `resolve_supersede_publish_slug`.
 *
 * Whenever `supersedes_id` is set the new row also inherits the source's
 * identity — `published_at` here, `legacy_id` via
 * `inherit_identity_from_source`. That's independent of which of the two
 * paths above runs, because an unarchived source is already `deleted` by
 * publish time and so takes the first-publish branch.
 */
export async function publish_article(
	input: z.infer<typeof publish_article_validator>,
) {
	const transaction = await db.transaction(async (tx) => {
		const existing = await tx.query.Article.findFirst({
			where: eq(Article.id, input.article_id),
			columns: { id: true, published_at: true, supersedes_id: true },
		});
		if (!existing) throw new Error("Article not found");

		// Only a plain read to decide which publish path this is; the locking
		// re-read inside `resolve_supersede_publish_slug` is what actually
		// guards the race on the source's slug.
		const source = existing.supersedes_id
			? ((await tx.query.Article.findFirst({
					where: eq(Article.id, existing.supersedes_id),
					columns: { status: true, published_at: true },
				})) ?? null)
			: null;

		const is_supersede = Boolean(
			existing.supersedes_id && is_supersede_publish(source),
		);

		const published_at = decide_published_at({
			requested: input.article.published_at,
			source,
			existing,
			now: new Date(),
		});

		const thumbnail = await resolve_thumbnail(tx, input.article.thumbnail_crop);

		const updated = await tx
			.update(Article)
			.set({
				title: input.article.title,
				content_json: input.article.content ?? undefined,
				status: "published",
				published_at,
				...thumbnail,
			})
			.where(eq(Article.id, input.article_id))
			.returning();

		assert_one(updated);

		await replace_article_authors(tx, input.article_id, input.author_ids);
		// Reconcile against the *persisted* content (see `save_article`) so a
		// publish that omits `content` doesn't wipe existing media links.
		await reconcile_media_to_articles(
			tx,
			input.article_id,
			updated[0].content_json,
		);

		const { primary, unlist_algolia_id } =
			is_supersede && existing.supersedes_id
				? await resolve_supersede_publish_slug(
						tx,
						input.article_id,
						existing.supersedes_id,
						input.article.title,
					)
				: {
						primary: await resolve_first_publish_slug(
							tx,
							input.article_id,
							input.article.title,
						),
						unlist_algolia_id: null,
					};

		// Both publish paths: the supersede-publish one above has already
		// soft-deleted the source, and the unarchive one had its source retired
		// back at draft creation. Either way the id must not stay behind.
		if (existing.supersedes_id) {
			await inherit_identity_from_source(
				tx,
				input.article_id,
				existing.supersedes_id,
			);
		}

		const article = await find_article_with_relations(
			tx,
			eq(Article.id, input.article_id),
		);
		if (!article) throw new Error("Published article not found");

		return { article, slug: primary.slug, unlist_algolia_id };
	});

	// Algolia calls are network I/O and best-effort (see `add_or_update_algolia`
	// / `remove_from_algolia`) — run after the transaction has committed, not
	// inside it, so a slow or failing Algolia call can't extend how long the
	// supersede-publish `FOR UPDATE` lock is held, and can't roll back a
	// publish that already succeeded in the DB.
	if (transaction.unlist_algolia_id) {
		await remove_from_algolia(transaction.unlist_algolia_id);
	}
	await add_or_update_algolia(
		convert_new_article_to_algolia_object({
			article: transaction.article,
			slug: transaction.slug,
			authors: transaction.article.articles_to_authors,
			thumbnail_media: transaction.article.thumbnail_media,
		}),
	);

	apply_server_invalidations("article.published");
	return { article: transaction.article, slug: transaction.slug };
}
