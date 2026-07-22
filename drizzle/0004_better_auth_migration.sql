-- NextAuth v4 -> better-auth (#32).
--
-- Hand-written rather than generated, because the one thing that matters here
-- cannot be diffed: `user` rows and their `id` values must survive. `id` is the
-- foreign-key target of articles.created_by, author.user_id and media.user_id —
-- if better-auth ever creates a *new* user row for a returning editor, the
-- club's whole authorship history is orphaned.
--
-- `session`, `account` and `verification_token` are dropped outright. Nothing
-- references them, and dropping them is what forces the intended one-time
-- re-login; better-auth re-creates the `account` row on the next successful
-- sign-in via email-matched account linking.

DROP TABLE IF EXISTS "session" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "account" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "verification_token" CASCADE;--> statement-breakpoint

-- `user`: altered in place. Rows and ids are untouched.

-- better-auth requires a name. Existing rows all have one from Google; the
-- fallback only exists so a stray NULL cannot block the deploy.
UPDATE "user" SET "name" = split_part("email", '@', 1) WHERE "name" IS NULL;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint

-- Fails loudly if two rows share an address, rather than letting better-auth
-- link against an ambiguous match later.
ALTER TABLE "user" ADD CONSTRAINT "user_email_unique" UNIQUE("email");--> statement-breakpoint

-- emailVerified: nullable timestamp -> required boolean.
-- The UPDATE below is the load-bearing step. better-auth consults this column
-- when deciding whether an incoming Google sign-in links to this row; leaving
-- it false is what would mint a new user id. Every preserved row is a
-- Google-verified @jknm.si address, so `true` is correct as well as necessary.
ALTER TABLE "user" DROP COLUMN "email_verified";--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "email_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "user" SET "email_verified" = true;--> statement-breakpoint

ALTER TABLE "user" ADD COLUMN "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint

-- better-auth's own tables.

CREATE TABLE "account" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"provider_id" varchar(255) NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);--> statement-breakpoint

CREATE TABLE "session" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);--> statement-breakpoint

CREATE TABLE "verification" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);--> statement-breakpoint

ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");
