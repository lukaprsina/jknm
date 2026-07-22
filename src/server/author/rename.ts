import { eq } from "drizzle-orm";
import type { z } from "zod";
import { apply_server_invalidations } from "../cache-invalidation";
import { db } from "../db";
import { Author } from "../db/schema";
import type { rename_guest_validator } from "./validator";

export async function rename_guest(
	input: z.infer<typeof rename_guest_validator>,
) {
	const result = await db
		.update(Author)
		.set({ name: input.name })
		.where(eq(Author.id, input.id))
		.returning();

	apply_server_invalidations("author.renamed");

	return result;
}
