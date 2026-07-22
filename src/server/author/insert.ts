"use server";

import type { z } from "zod";
import { apply_server_invalidations } from "../cache-invalidation";
import { db } from "../db";
import { Author } from "../db/schema";
import type { insert_guest_validator } from "./validator";

export async function insert_guest(
	input: z.infer<typeof insert_guest_validator>,
) {
	const result = await db
		.insert(Author)
		.values({
			author_type: "guest",
			name: input.name,
		})
		.returning();

	apply_server_invalidations("author.inserted");

	return result;
}
