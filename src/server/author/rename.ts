"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import type { z } from "zod";
import { getServerAuthSession } from "../auth";
import { db } from "../db";
import { Author } from "../db/schema";
import { rename_guest_validator } from "./validator";

export async function rename_guest(
	input: z.infer<typeof rename_guest_validator>,
) {
	const session = await getServerAuthSession();
	if (!session) {
		throw new Error("Unauthorized");
	}

	const validated_input = rename_guest_validator.safeParse(input);
	if (!validated_input.success) {
		throw new Error(validated_input.error.message);
	}

	const result = await db
		.update(Author)
		.set({ name: input.name })
		.where(eq(Author.id, input.id))
		.returning();

	revalidateTag("authors", "max");
	revalidatePath("/");

	return result;
}
