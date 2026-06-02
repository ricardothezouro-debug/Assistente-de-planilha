import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const entries = pgTable("entries", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  name: text("name").notNull(),
  totalAmountCents: integer("total_amount_cents").notNull(),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id),
  startDate: text("start_date").notNull(),
  installments: integer("installments").notNull().default(1),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const occurrences = pgTable(
  "occurrences",
  {
    id: serial("id").primaryKey(),
    entryId: integer("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id),
    type: text("type").notNull(),
    name: text("name").notNull(),
    dueDate: text("due_date").notNull(),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    amountCents: integer("amount_cents").notNull(),
    installmentNumber: integer("installment_number"),
    installmentTotal: integer("installment_total"),
    status: text("status").notNull(),
    paidAt: text("paid_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_occurrences_year_month").on(table.year, table.month),
    index("idx_occurrences_status").on(table.status),
  ]
);
