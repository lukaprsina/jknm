"use server";

import type { z } from "zod";
import { db } from "../db";
import { Author } from "../db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { rename_guest_validator } from "./validator";

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
  revalidatePath("/");

  return result;
}
