"use server";

import { and, eq, inArray } from "drizzle-orm";
import type { z } from "zod";
import { getServerAuthSession } from "../auth";
import { apply_server_invalidations } from "../cache-invalidation";
import { db } from "../db";
import { Author } from "../db/schema";
import { delete_guests_validator } from "./validator";

export async function delete_guests(
	input: z.infer<typeof delete_guests_validator>,
) {
	const session = await getServerAuthSession();
	if (!session) {
		throw new Error("Unauthorized");
	}

	const validated_input = delete_guests_validator.safeParse(input);
	if (!validated_input.success) {
		throw new Error(validated_input.error.message);
	}

	const result = await db
		.delete(Author)
		.where(and(eq(Author.author_type, "guest"), inArray(Author.id, input.ids)))
		.returning();

	apply_server_invalidations("author.deleted");

	return result;
}
