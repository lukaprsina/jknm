"use server"

import { z } from "zod";
import { db } from "../db";
import { Author } from "../db/schema";
import { revalidatePath, revalidateTag } from "next/cache";

export const insert_guest_validator = z.object({ name: z.string() })

export async function insert_guest(
    input: z.infer<typeof insert_guest_validator>,
) {
    const validated_input = insert_guest_validator.safeParse(input);
    if (!validated_input.success) {
        throw new Error(validated_input.error.message);
    }

    const result = await db
    .insert(Author)
    .values({
      author_type: "guest",
      name: input.name,
    })
    .returning();

    revalidateTag("authors");
    revalidatePath("/")

    return result;
}