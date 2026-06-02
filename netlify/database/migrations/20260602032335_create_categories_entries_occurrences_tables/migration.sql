CREATE TABLE "categories" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE TABLE "entries" (
	"id" serial PRIMARY KEY,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"total_amount_cents" integer NOT NULL,
	"category_id" integer NOT NULL,
	"start_date" text NOT NULL,
	"installments" integer DEFAULT 1 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "occurrences" (
	"id" serial PRIMARY KEY,
	"entry_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"due_date" text NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"installment_number" integer,
	"installment_total" integer,
	"status" text NOT NULL,
	"paid_at" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_occurrences_year_month" ON "occurrences" ("year","month");--> statement-breakpoint
CREATE INDEX "idx_occurrences_status" ON "occurrences" ("status");--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_category_id_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id");--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_entry_id_entries_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entries"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_category_id_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id");