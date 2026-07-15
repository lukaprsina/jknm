import type { Article } from "../db/schema";

type ArticleStatus = (typeof Article.$inferSelect)["status"];

/**
 * Pure status-transition guards and the slug-inherit-vs-demote decision for
 * #21's lifecycle (archive/delete/unarchive/supersede-publish). Kept free of
 * DB/network calls so the transition rules are unit-testable without a live
 * database; `lifecycle.ts` and `new-article.ts` call these before touching
 * the DB.
 */

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
 * The "Arhiv" accordion's origin badge: whether an archived article was ever
 * live, or was archived straight from a draft.
 */
export function get_archive_origin_badge({
	published_at,
}: {
	published_at: Date | null;
}): "bil objavljen" | "bil osnutek" {
	return published_at ? "bil objavljen" : "bil osnutek";
}
