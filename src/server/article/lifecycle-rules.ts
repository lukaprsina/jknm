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
