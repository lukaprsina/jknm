"use server"

import { z } from "zod";
import { db } from "../db";
import { Author } from "../db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";

export const delete_guests_validator = z.object({ ids: z.array(z.number()) });

export async function delete_guests(
    input: z.infer<typeof delete_guests_validator>,
) {
    const validated_input = delete_guests_validator.safeParse(input);
    if (!validated_input.success) {
        throw new Error(validated_input.error.message);
    }

    const result = await db
        .delete(Author)
        .where(
            and(eq(Author.author_type, "guest"), inArray(Author.id, input.ids)),
        )
        .returning();

    revalidateTag("authors");
    revalidatePath("/")

    return result;
}