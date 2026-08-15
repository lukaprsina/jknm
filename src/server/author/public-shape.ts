import type { Author } from "../db/schema";

/**
 * The only author fields any client component is allowed to read. Everything
 * else on an `Author` row (`google_id`, `email`, `image`, `user_id`) is
 * internal identity data that must never cross the Server→Client boundary into
 * the RSC payload. Kept explicit rather than derived from the row type so the
 * contract reads as a deliberate allowlist, not a coincidental projection.
 */
export interface PublicAuthor {
	id: number;
	author_type: "member" | "guest";
	first_name: string;
	last_name: string;
}

/**
 * The Drizzle `columns` projection matching `PublicAuthor`, for relation loads
 * whose rows cross a Server→Client boundary. Shared so the allowlist above has
 * a single source of truth instead of a copy per query site.
 */
export const PUBLIC_AUTHOR_COLUMNS = {
	id: true,
	author_type: true,
	first_name: true,
	last_name: true,
} as const;

type AuthorRow = typeof Author.$inferSelect;

/** Strip an `Author` row down to `PublicAuthor` before it reaches a client boundary. */
export function to_public_author(author: AuthorRow): PublicAuthor {
	return {
		id: author.id,
		author_type: author.author_type,
		first_name: author.first_name,
		last_name: author.last_name,
	};
}