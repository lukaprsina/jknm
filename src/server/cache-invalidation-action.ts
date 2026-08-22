"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { CACHE_PATHS, CACHE_TAGS } from "~/lib/cache-policy";
import { getServerAuthSession } from "~/server/auth";

const selection_validator = z
	.object({
		tags: z.array(z.enum(CACHE_TAGS)),
		paths: z.array(z.enum(CACHE_PATHS)),
	})
	.refine(
		(selection) => selection.tags.length > 0 || selection.paths.length > 0,
		{
			message: "Izberite vsaj eno možnost.",
		},
	);

export type CacheInvalidationSelection = z.infer<typeof selection_validator>;

/**
 * Manually expires selected server-cache targets for an authenticated admin.
 * This is deliberately a Server Action: `updateTag` provides the desired
 * read-your-own-writes behaviour and is not available from a Route Handler.
 */
export async function invalidate_selected_cache(
	input: CacheInvalidationSelection,
) {
	if (!(await getServerAuthSession())) {
		throw new Error("Unauthorized");
	}

	const selection = selection_validator.parse(input);

	for (const tag of selection.tags) {
		updateTag(tag);
	}

	for (const path of selection.paths) {
		revalidatePath(path);
	}

	return selection;
}
