ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "display_name" text;--> statement-breakpoint
ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "categories_name_unique";--> statement-breakpoint
ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "categories_name_key";--> statement-breakpoint
DROP INDEX IF EXISTS "categories_name_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "categories_name_key";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_categories_user_name" ON "categories" ("user_id", "name");
