import { eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { settings, categories, users } from "../../../db/schema.js";
import {
  ACTIVE_YEAR,
  CATEGORIES,
  ENTRY_FIXED,
  ENTRY_INSTALLMENT,
  INITIAL_INVESTED_CENTS,
} from "./constants.js";
import { createEntry } from "./finance.js";

export const DEFAULT_USERNAME = "gamoxkun";
export const DEFAULT_PASSWORD_HASH = "611fd55829d3540c2bc56b6c27777c8f19bfb63aee2ff595ac0b9160ed200ad3";

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

export async function initializeDefaultsForUser(
  userId: number,
  initialInvestedCents = 0
): Promise<void> {
  for (const name of CATEGORIES) {
    await db
      .insert(categories)
      .values({ userId, name })
      .onConflictDoNothing();
  }
  await db
    .insert(settings)
    .values({ userId, key: "active_year", value: String(ACTIVE_YEAR) })
    .onConflictDoNothing();
  await db
    .insert(settings)
    .values({
      userId,
      key: "initial_invested_cents",
      value: String(initialInvestedCents),
    })
    .onConflictDoNothing();
}

export async function seedDefaultUserIfNeeded(): Promise<void> {
  await db
    .insert(users)
    .values({ username: DEFAULT_USERNAME, passwordHash: DEFAULT_PASSWORD_HASH })
    .onConflictDoNothing();

  const [defaultUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, DEFAULT_USERNAME))
    .limit(1);

  if (!defaultUser) {
    throw new Error("Usuario padrao nao encontrado.");
  }

  await initializeDefaultsForUser(defaultUser.id, INITIAL_INVESTED_CENTS);

  // Try to claim the seed lock atomically
  const result = await db
    .insert(settings)
    .values({ userId: defaultUser.id, key: "seeded_initial_data", value: "1" })
    .onConflictDoNothing()
    .returning();

  if (result.length === 0) return; // Already seeded by a prior invocation

  for (const entry of INITIAL_ENTRIES) {
    await createEntry(
      defaultUser.id,
      entry.type,
      entry.name,
      entry.amountCents,
      entry.category,
      entry.startDate,
      entry.installments
    );
  }
}
