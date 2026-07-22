import { and, eq, inArray } from "drizzle-orm";
import type { z } from "zod";
import { apply_server_invalidations } from "../cache-invalidation";
import { db } from "../db";
import { Author } from "../db/schema";
import type { delete_guests_validator } from "./validator";

export async function delete_guests(
	input: z.infer<typeof delete_guests_validator>,
) {
	const result = await db
		.delete(Author)
		.where(and(eq(Author.author_type, "guest"), inArray(Author.id, input.ids)))
		.returning();

	apply_server_invalidations("author.deleted");

	return result;
}
