CREATE TABLE IF NOT EXISTS "users" (
  "id" serial PRIMARY KEY,
  "username" text NOT NULL UNIQUE,
  "password_hash" text NOT NULL,
  "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
INSERT INTO "users" ("username", "password_hash")
VALUES ('gamoxkun', '611fd55829d3540c2bc56b6c27777c8f19bfb63aee2ff595ac0b9160ed200ad3')
ON CONFLICT ("username") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "user_id" integer;
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "user_id" integer;
--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN IF NOT EXISTS "user_id" integer;
--> statement-breakpoint
ALTER TABLE "occurrences" ADD COLUMN IF NOT EXISTS "user_id" integer;
--> statement-breakpoint
UPDATE "settings" SET "user_id" = (SELECT "id" FROM "users" WHERE "username" = 'gamoxkun') WHERE "user_id" IS NULL;
--> statement-breakpoint
UPDATE "categories" SET "user_id" = (SELECT "id" FROM "users" WHERE "username" = 'gamoxkun') WHERE "user_id" IS NULL;
--> statement-breakpoint
UPDATE "entries" SET "user_id" = (SELECT "id" FROM "users" WHERE "username" = 'gamoxkun') WHERE "user_id" IS NULL;
--> statement-breakpoint
UPDATE "occurrences" SET "user_id" = (SELECT "id" FROM "users" WHERE "username" = 'gamoxkun') WHERE "user_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "entries" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "occurrences" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "settings" DROP CONSTRAINT IF EXISTS "settings_pkey";
--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("user_id", "key");
--> statement-breakpoint
ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "categories_name_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_categories_user_name" ON "categories" ("user_id", "name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_occurrences_user_year_month" ON "occurrences" ("user_id", "year", "month");
--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
