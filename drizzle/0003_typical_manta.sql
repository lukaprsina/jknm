DROP INDEX "articles_legacy_id_idx";--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_legacy_id_unique" UNIQUE("legacy_id");