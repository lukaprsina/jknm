"use server"

import { z } from "zod";
import { db } from "../db";
import { Author } from "../db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";

export const rename_guest_validator = z.object({ id: z.number(), name: z.string() })

export async function rename_guest(
    input: z.infer<typeof rename_guest_validator>,
) {
    const validated_input = rename_guest_validator.safeParse(input);
    if (!validated_input.success) {
        throw new Error(validated_input.error.message);
    }

    const result = await db
    .update(Author)
    .set({ name: input.name })
    .where(eq(Author.id, input.id))
    .returning();

    revalidateTag("authors");
    revalidatePath("/")

    return result;
}