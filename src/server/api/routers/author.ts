import { env } from "~/env";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import type { JWTInput } from "google-auth-library";
import { google } from "googleapis";
import { Author } from "~/server/db/schema";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";

export const author_router = createTRPCRouter({
  get_all: publicProcedure
    .input(z.enum(["member", "guest"]).optional())
    .query(async ({ ctx, input }) => {
      // console.error("AAAAAAAAAAAAAAAAAAAAAAAAAAAA: get_all", input);
      return input
        ? await ctx.db.query.Author.findMany({
            where: eq(Author.author_type, input),
          })
        : await ctx.db.query.Author.findMany();
    }),

  insert_guest: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      return ctx.db
        .insert(Author)
        .values({
          author_type: "guest",
          name: input,
        })
        .returning();
    }),

  delete_guests: protectedProcedure
    .input(z.object({ ids: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db
        .delete(Author)
        .where(
          and(eq(Author.author_type, "guest"), inArray(Author.id, input.ids)),
        )
        .returning();
    }),

  rename_guest: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db
        .update(Author)
        .set({ name: input.name })
        .where(eq(Author.id, input.id))
        .returning();
    }),

  sync_with_google: protectedProcedure.query(async ({ ctx }) => {
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

    const google_result = await ctx.db
      .insert(Author)
      .values(mapped_users)
      .returning();

    console.log("Inserted google authors", google_result.length);
    return google_result;
  }),
});
