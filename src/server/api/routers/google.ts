import { env } from "~/env";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import type { JWTInput } from "google-auth-library";
import { google } from "googleapis";
import type { Author } from "~/server/db/schema";

export const google_router = createTRPCRouter({
  sync_users: protectedProcedure.query(async () => {
    console.log("GETTING GOOGLE USERS");

    const credentials = env.JKNM_SERVICE_ACCOUNT_CREDENTIALS;
    if (!credentials) {
      console.error("No credentials found");
      return;
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
      throw new Error("No users found");
    }

    const mapped_users: (typeof Author.$inferInsert)[] = result.data.users
      .map((user) => {
        const name = user.name?.fullName;

        if (!name) {
          console.error(`No full name for Google user ${user.id}`);
          return;
        }

        return {
          author_type: "member",
          google_id: user.id ?? undefined,
          email: user.primaryEmail ?? undefined,
          name,
          image: user.thumbnailPhotoUrl ?? undefined,
        } satisfies typeof Author.$inferInsert;
      })
      .filter((user) => typeof user !== "undefined");

    console.log("GOT GOOGLE USERS", mapped_users.length);
  }),
});
