"use server";

import { z } from "zod";
import { google } from "googleapis";
import { db } from "../db";
import { Author } from "../db/schema";
import { revalidatePath, revalidateTag } from "next/cache";
import { env } from "~/env";
import type { JWTInput } from "google-auth-library";

export const sync_members_validator = z.object({ name: z.string() });

// TODO
export async function sync_members(
  input: z.infer<typeof sync_members_validator>,
) {
  const validated_input = sync_members_validator.safeParse(input);
  if (!validated_input.success) {
    throw new Error(validated_input.error.message);
  }

  const credentials = env.JKNM_SERVICE_ACCOUNT_CREDENTIALS;
  if (!credentials) {
    throw new Error("No credentials for Google Admin found");
  }

  const credentials_text = atob(credentials);
  const credentials_json = JSON.parse(credentials_text) as Partial<JWTInput>;
  const google_client = await google.auth.getClient({
    credentials: credentials_json,
    scopes: ["https://www.googleapis.com/auth/admin.directory.user.readonly"],
  });

  const service = google.admin({
    version: "directory_v1",
    auth: google_client,
  });

  const result = await service.users.list({
    customer: "C049fks0l",
  });

  if (!result.data.users) {
    throw new Error("No Google Admin users found");
  }

  const mapped_users: (typeof Author.$inferInsert)[] = [];
  const uniqueGoogleIds = new Set<string>();

  result.data.users.forEach((user) => {
    const name = user.name?.fullName;

    if (!name) {
      throw new Error(`No full name for Google user ${user.id}`);
      // console.error(`No full name for Google user ${user.id}`);
      // return;
    }

    const googleId = user.id ?? undefined;

    if (!googleId) {
      throw new Error(`No Google ID for user ${name}`);
    }
    if (uniqueGoogleIds.has(googleId)) {
      throw new Error(`Duplicate Google ID for user ${name}`);
    }

    uniqueGoogleIds.add(googleId);

    mapped_users.push({
      author_type: "member",
      google_id: googleId,
      email: user.primaryEmail ?? undefined,
      name,
      image: user.thumbnailPhotoUrl ?? undefined,
    } satisfies typeof Author.$inferInsert);
  });
  // .filter((user) => typeof user !== "undefined");

  const google_result = await db
    .insert(Author)
    .values(mapped_users)
    .returning();

  revalidateTag("authors");
  revalidatePath("/");

  console.log("Inserted google authors", google_result.length);
  return google_result;
}
