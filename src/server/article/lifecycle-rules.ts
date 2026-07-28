import type { Article } from "../db/schema";

type ArticleStatus = (typeof Article.$inferSelect)["status"];

/**
 * Pure status-transition guards and the slug-inherit-vs-demote decision for
 * #21's lifecycle (archive/delete/unarchive/supersede-publish). Kept free of
 * DB/network calls so the transition rules are unit-testable without a live
 * database; `lifecycle.ts` and `new-article.ts` call these before touching
 * the DB.
 */

/**
 * Confirm-dialog copy for archiving/deleting a superseding draft, shared by
 * the toolbar (`toolbar-buttons.tsx`) and settings dialog (`settings-form.tsx`)
 * so the wording can't drift between the two surfaces.
 */
export const SUPERSEDING_DRAFT_DIALOGS = {
	archive: {
		title: "Arhiviraj novičko?",
		description:
			"Objavljena novička bo arhivirana in umaknjena z glavne strani. Ta osnutek bo zavržen.",
	},
	delete: {
		title: "Izbriši novičko?",
		description:
			"To bo izbrisalo objavljeno novičko za vse obiskovalce, ne samo ta osnutek.",
	},
} as const;

export function assert_can_archive(status: ArticleStatus) {
	if (status !== "draft" && status !== "published") {
		throw new Error(`Cannot archive an article with status "${status}"`);
	}
}

export function assert_can_delete(status: ArticleStatus) {
	if (status === "deleted") {
		throw new Error("Article is already deleted");
	}
}

/**
 * "Zavrzi osnutek" guard: only a superseding draft (one with `supersedes_id`
 * set) can be discarded this way — it's the "cancel this edit, leave the
 * live/archived source untouched" action, distinct from `delete_article`
 * which for a superseding draft deletes the source instead. A standalone
 * draft has no source to fall back to, so it must go through delete.
 */
export function assert_can_discard(article: {
	status: ArticleStatus;
	supersedes_id: string | null;
}) {
	if (article.status !== "draft") {
		throw new Error(
			`Cannot discard an article with status "${article.status}"`,
		);
	}
	if (!article.supersedes_id) {
		throw new Error(
			"Only a superseding draft can be discarded; use delete for a standalone draft",
		);
	}
}

export interface LifecycleRow {
	id: string;
	status: ArticleStatus;
	supersedes_id: string | null;
}

/**
 * Archive/delete on a superseding draft act on the article it supersedes
 * (the live/archived source) rather than the throwaway draft itself — the
 * draft is then cascade-deleted since it's now moot. A standalone
 * draft/published/archived row is its own target — as is a draft whose
 * source has already been deleted (unarchiving deletes the archived source
 * immediately, so from that point on the draft is standalone in all but
 * name; there's no live source left to retarget onto).
 */
export function resolve_lifecycle_target(
	article: LifecycleRow,
	source: LifecycleRow | null,
): { target: LifecycleRow; cascade_delete_draft_id: string | null } {
	if (!article.supersedes_id) {
		return { target: article, cascade_delete_draft_id: null };
	}
	if (!source) throw new Error("Source article not found");
	if (source.status === "deleted") {
		return { target: article, cascade_delete_draft_id: null };
	}
	return { target: source, cascade_delete_draft_id: article.id };
}

/**
 * Guards spawning a new superseding draft (unarchive, or "revise while
 * live"): the source must be the current live/visible row, i.e. `archived`
 * or `published`.
 */
export function assert_can_supersede(status: ArticleStatus) {
	if (status !== "archived" && status !== "published") {
		throw new Error(
			`Cannot create a superseding draft from an article with status "${status}"`,
		);
	}
}

/**
 * Whether publishing a draft with `supersedes_id` set should retire and
 * slug-inherit from `source` (a real supersede-publish), or fall back to a
 * standalone first-publish.
 *
 * A superseding draft's source can already be `deleted` by the time the
 * draft is published: unarchiving retires an `archived` source immediately,
 * before the new draft is ever published (`create_superseding_draft`).
 * `resolve_lifecycle_target` already treats that draft as standalone for
 * archive/delete/discard — publish must agree, or publishing it throws via
 * `assert_can_supersede` instead of falling back the same way.
 */
export function is_supersede_publish(
	source: { status: ArticleStatus } | null,
): boolean {
	return (
		source !== null &&
		(source.status === "archived" || source.status === "published")
	);
}

/**
 * The `published_at` a publish should end up with. A superseding draft is a
 * fresh row, so its own `published_at` is null — falling through to `now`
 * would silently re-date the article to today every time it's revised,
 * bumping it to the top of the news list and moving it between years in the
 * archive (the `published_year` generated column derives from this).
 * Revising an article isn't republishing it, so the source's original date
 * wins whenever a source exists.
 *
 * Deliberately keyed on "a source exists", not on `is_supersede_publish`: the
 * unarchive path retires its source at draft-creation time, so
 * `is_supersede_publish` is already false by publish time even though this
 * is still the same article and must still inherit its date. A source that
 * was archived straight from `draft` has a null `published_at` and correctly
 * falls through to `existing.published_at ?? now`.
 */
/**
 * Whether discarding a superseding draft must also restore its source back to
 * `archived`. True exactly when the source is currently `deleted` — the only
 * way that happens while the draft is still `draft` is
 * `create_superseding_draft`'s immediate retirement of an `archived` source at
 * unarchive time (see its doc comment): nothing else can delete a source out
 * from under an open draft, since a superseded source's own page 404s
 * (`is_visible_to`), leaving no UI path to delete it directly, and
 * `assert_can_supersede` requires `archived`/`published` at draft-creation
 * time. Discarding without restoring would silently turn "cancel this edit"
 * into "delete the article", contradicting `discard_draft`'s own contract.
 */
export function should_restore_source_on_discard(
	source: { status: ArticleStatus } | null,
): boolean {
	return source?.status === "deleted";
}

export function decide_published_at({
	source,
	existing,
	now,
}: {
	source: { published_at: Date | null } | null;
	existing: { published_at: Date | null };
	now: Date;
}): Date {
	return source?.published_at ?? existing.published_at ?? now;
}

export type SlugTransitionDecision =
	| { action: "reuse"; slug_id: number }
	| { action: "mint_new_and_demote"; demote_slug_id: number }
	| { action: "mint_new" };

/**
 * Supersede-publish's slug rule: if the title didn't change, the superseded
 * article's primary slug is inherited (re-pointed to the newly-published
 * row). If it changed, a new slug is minted as primary and the old one is
 * demoted to non-primary (kept, resolvable, not deleted).
 */
export function decide_slug_transition({
	old_title,
	new_title,
	old_primary_slug,
}: {
	old_title: string;
	new_title: string;
	old_primary_slug: { id: number } | null;
}): SlugTransitionDecision {
	if (!old_primary_slug) return { action: "mint_new" };

	if (old_title === new_title) {
		return { action: "reuse", slug_id: old_primary_slug.id };
	}

	return { action: "mint_new_and_demote", demote_slug_id: old_primary_slug.id };
}

/**
 * Public `/novica/<slug>` visibility rule: `deleted` is terminal and 404s for
 * everyone; `archived` 404s for non-admins (admins see it via the "Arhiv"
 * accordion); `published` is visible to everyone.
 */
export function is_visible_to(status: ArticleStatus, is_admin: boolean) {
	if (status === "deleted") return false;
	if (status === "archived") return is_admin;
	return true;
}

/**
 * The primary (canonical) slug row of an article, or `undefined` if none is
 * flagged. Deliberately **without** the `?? slugs[0]` fallback its two callers
 * in `new-adapter.ts` and `sync-algolia.ts` want: those need *a* slug to render
 * or index with, whereas `resolve_slug_request` below must be able to tell
 * "no canonical slug exists" from "the canonical slug is X" — it decides
 * whether to redirect, and a fallback would invent a redirect target. Callers
 * that want the fallback append their own.
 *
 * Structurally typed, not `NewArticleWithRelations`, to keep this module free
 * of DB and framework types.
 */
export function find_primary_slug<T extends { is_primary: boolean }>(
	slugs: T[],
): T | undefined {
	return slugs.find((slug) => slug.is_primary);
}

/**
 * `find_primary_slug`, falling back to any slug — what every caller that
 * needs *a* URL to render or index with actually wants (the no-fallback
 * behavior above exists only for `resolve_slug_request`, which must tell "no
 * canonical slug" apart from "the canonical slug is X"). Shared so the same
 * `?? slugs[0]` fallback isn't hand-rolled at every call site.
 */
export function find_primary_slug_or_first<T extends { is_primary: boolean }>(
	slugs: T[],
): T | undefined {
	return find_primary_slug(slugs) ?? slugs[0];
}

/**
 * What `/novica/<slug>` should do with one incoming request. A three-way
 * outcome rather than an article-or-nothing, because "this article exists but
 * you asked for it by a retired name" is a third case the nullable shape can't
 * express — and the case the route used to get wrong by serving a 200.
 */
export type SlugRequestResolution =
	| { outcome: "render" }
	| { outcome: "redirect_to_primary"; slug: string }
	| { outcome: "not_found" };

/**
 * The whole `/novica/<slug>` request rule in one place: visibility first, then
 * slug canonicality.
 *
 * That order is deliberate. `article_slugs` deliberately retains a renamed
 * article's old slugs (`CONTEXT.md`) so they stay resolvable, but a hit on an
 * old slug is only worth a redirect if the destination will actually render.
 * Checking canonicality first would send a crawler to a URL that then 404s —
 * a wasted hop, and an ambiguous canonical signal for the old URL. Answer
 * once, honestly.
 *
 * `article_slugs` is taken structurally (not as the Drizzle relation type) to
 * keep this module free of DB and framework types, like the rest of the file.
 * The caller translates the outcome into `notFound()` / `permanentRedirect()`.
 */
export function resolve_slug_request({
	requested_slug,
	article,
	is_admin,
}: {
	requested_slug: string;
	article:
		| {
				status: ArticleStatus;
				article_slugs: { slug: string; is_primary: boolean }[];
		  }
		| null
		| undefined;
	is_admin: boolean;
}): SlugRequestResolution {
	if (!article) return { outcome: "not_found" };
	if (!is_visible_to(article.status, is_admin)) return { outcome: "not_found" };

	const primary_slug = find_primary_slug(article.article_slugs)?.slug;

	// No primary flagged is a data anomaly (`create_article` always writes one).
	// Serve the article at whichever slug resolved it rather than inventing a
	// redirect target — the requested slug is known-good, having found this row.
	if (primary_slug && primary_slug !== requested_slug) {
		return { outcome: "redirect_to_primary", slug: primary_slug };
	}

	return { outcome: "render" };
}

/**
 * The "Arhiv" accordion's origin label: whether an archived article was ever
 * live, or was archived straight from a draft.
 */
export function get_archive_origin_label({
	published_at,
}: {
	published_at: Date | null;
}): "bil objavljen" | "bil osnutek" {
	return published_at ? "bil objavljen" : "bil osnutek";
}
