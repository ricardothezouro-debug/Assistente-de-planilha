import { eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { settings, categories } from "../../../db/schema.js";
import {
  ACTIVE_YEAR,
  CATEGORIES,
  ENTRY_FIXED,
  ENTRY_INSTALLMENT,
  INITIAL_INVESTED_CENTS,
} from "./constants.js";
import { createEntry } from "./finance.js";

const INITIAL_ENTRIES = [
  { type: ENTRY_FIXED, name: "Vivo", amountCents: 4300, category: "Assinatura", startDate: "2026-02-01", installments: 1 },
  { type: ENTRY_FIXED, name: "Mei", amountCents: 8090, category: "Outros", startDate: "2026-02-01", installments: 1 },
  { type: ENTRY_FIXED, name: "YouTube Premium", amountCents: 2690, category: "Assinatura", startDate: "2026-02-01", installments: 1 },
  { type: ENTRY_FIXED, name: "Crunchyroll", amountCents: 1999, category: "Assinatura", startDate: "2026-02-01", installments: 1 },
  { type: ENTRY_FIXED, name: "Google One", amountCents: 999, category: "Assinatura", startDate: "2026-02-01", installments: 1 },
  { type: ENTRY_FIXED, name: "Cap cut", amountCents: 3290, category: "Assinatura", startDate: "2026-02-01", installments: 1 },
  { type: ENTRY_INSTALLMENT, name: "Celular", amountCents: 323100, category: "Outros", startDate: "2026-01-01", installments: 9 },
  { type: ENTRY_INSTALLMENT, name: "Cadeira gamer", amountCents: 77924, category: "Casa", startDate: "2026-01-01", installments: 4 },
  { type: ENTRY_INSTALLMENT, name: "Jogo Pokemon", amountCents: 25732, category: "Entretenimento", startDate: "2026-01-01", installments: 4 },
  { type: ENTRY_INSTALLMENT, name: "Viagem", amountCents: 121704, category: "Entretenimento", startDate: "2026-01-01", installments: 2 },
  { type: ENTRY_INSTALLMENT, name: "Silent hill F", amountCents: 22038, category: "Entretenimento", startDate: "2026-01-01", installments: 2 },
  { type: ENTRY_INSTALLMENT, name: "Resident evil", amountCents: 35180, category: "Entretenimento", startDate: "2026-04-01", installments: 4 },
] as const;

async function initializeDefaults(): Promise<void> {
  for (const name of CATEGORIES) {
    await db.insert(categories).values({ name }).onConflictDoNothing();
  }
  await db
    .insert(settings)
    .values({ key: "active_year", value: String(ACTIVE_YEAR) })
    .onConflictDoNothing();
  await db
    .insert(settings)
    .values({ key: "initial_invested_cents", value: String(INITIAL_INVESTED_CENTS) })
    .onConflictDoNothing();
}

export async function seedIfNeeded(): Promise<void> {
  await initializeDefaults();

  // Try to claim the seed lock atomically
  const result = await db
    .insert(settings)
    .values({ key: "seeded_initial_data", value: "1" })
    .onConflictDoNothing()
    .returning();

  if (result.length === 0) return; // Already seeded by a prior invocation

  for (const entry of INITIAL_ENTRIES) {
    await createEntry(
      entry.type,
      entry.name,
      entry.amountCents,
      entry.category,
      entry.startDate,
      entry.installments
    );
  }
}
