ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_admin" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "disabled_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "feature_flags" text NOT NULL DEFAULT '{}';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_email" ON "users" ("email");--> statement-breakpoint
UPDATE "users" SET "email" = COALESCE("email", 'gamoxkun@gmail.com'), "is_admin" = true WHERE "username" = 'gamoxkun';
