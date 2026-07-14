CREATE TYPE "public"."article_status" AS ENUM('draft', 'published', 'archived', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."media_upload_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"legacy_id" integer,
	"status" "article_status" DEFAULT 'draft' NOT NULL,
	"title" varchar(255) NOT NULL,
	"excerpt" text DEFAULT '',
	"content_json" jsonb,
	"thumbnail_media_id" uuid,
	"thumbnail_x" real,
	"thumbnail_y" real,
	"thumbnail_width" real,
	"thumbnail_height" real,
	"supersedes_id" uuid,
	"created_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"published_year" integer GENERATED ALWAYS AS (EXTRACT(YEAR FROM (published_at AT TIME ZONE 'UTC'))) STORED
);
--> statement-breakpoint
CREATE TABLE "article_slugs" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(255) NOT NULL,
	"article_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "article_slugs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "articles_to_authors" (
	"article_id" uuid NOT NULL,
	"author_id" integer NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "articles_to_authors_article_id_author_id_pk" PRIMARY KEY("article_id","author_id")
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY NOT NULL,
	"filename" varchar(255) NOT NULL,
	"content_type" varchar(255) NOT NULL,
	"size_bytes" integer NOT NULL,
	"original" jsonb NOT NULL,
	"variants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"srcsets" jsonb,
	"blur_placeholder" text,
	"upload_status" "media_upload_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_to_articles" (
	"article_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "media_to_articles_article_id_media_id_pk" PRIMARY KEY("article_id","media_id")
);
--> statement-breakpoint
ALTER TABLE "author" ADD COLUMN "user_id" varchar(255);--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_thumbnail_media_id_media_id_fk" FOREIGN KEY ("thumbnail_media_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_supersedes_id_articles_id_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_slugs" ADD CONSTRAINT "article_slugs_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles_to_authors" ADD CONSTRAINT "articles_to_authors_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles_to_authors" ADD CONSTRAINT "articles_to_authors_author_id_author_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."author"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_to_articles" ADD CONSTRAINT "media_to_articles_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_to_articles" ADD CONSTRAINT "media_to_articles_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "articles_legacy_id_idx" ON "articles" USING btree ("legacy_id");--> statement-breakpoint
CREATE INDEX "articles_status_published_year_idx" ON "articles" USING btree ("status","published_year");--> statement-breakpoint
CREATE INDEX "article_slugs_article_id_idx" ON "article_slugs" USING btree ("article_id");--> statement-breakpoint
ALTER TABLE "author" ADD CONSTRAINT "author_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;