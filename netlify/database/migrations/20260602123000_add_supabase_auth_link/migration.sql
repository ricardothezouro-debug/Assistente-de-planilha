ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "supabase_user_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_supabase_user_id" ON "users" ("supabase_user_id");
