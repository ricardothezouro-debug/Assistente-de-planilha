import { asc, and, eq, ne, sql } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { settings, categories, entries, occurrences } from "../../../db/schema.js";
import {
  ACTIVE_YEAR,
  ENTRY_FIXED,
  ENTRY_INSTALLMENT,
  ENTRY_INCOME,
  MONTH_NAMES,
  STATUS_PAID,
  STATUS_UNPAID,
} from "./constants.js";
import { formatCents, splitAmount } from "./money.js";
import {
  addMonths,
  defaultStatusForDate,
  formatDateLabel,
  lastDayOfMonth,
  todayIso,
} from "./dates.js";

export type OccurrenceRow = {
  id: number;
  entryId: number;
  type: string;
  name: string;
  category: string;
  dueDate: string;
  amountCents: number;
  installmentNumber: number | null;
  installmentTotal: number | null;
  status: string;
};

export async function getInitialInvestedCents(userId: number): Promise<number> {
  const rows = await db
    .select()
    .from(settings)
    .where(and(eq(settings.userId, userId), eq(settings.key, "initial_invested_cents")))
    .limit(1);
  return rows.length > 0 ? parseInt(rows[0].value) : 0;
}

export async function setInitialInvestedCents(userId: number, cents: number): Promise<void> {
  await db
    .insert(settings)
    .values({ userId, key: "initial_invested_cents", value: String(cents) })
    .onConflictDoUpdate({
      target: [settings.userId, settings.key],
      set: { value: String(cents) },
    });
}

export async function getCategoryId(userId: number, name: string): Promise<number | null> {
  const rows = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.name, name)))
    .limit(1);
  return rows.length > 0 ? rows[0].id : null;
}

export async function getAllCategories(userId: number): Promise<string[]> {
  const rows = await db
    .select({ name: categories.name })
    .from(categories)
    .where(eq(categories.userId, userId))
    .orderBy(asc(categories.id));
  return rows.map((r) => r.name);
}

export async function listOccurrences(userId: number, year: number, month: number): Promise<OccurrenceRow[]> {
  return db
    .select({
      id: occurrences.id,
      entryId: occurrences.entryId,
      type: occurrences.type,
      name: occurrences.name,
      category: categories.name,
      dueDate: occurrences.dueDate,
      amountCents: occurrences.amountCents,
      installmentNumber: occurrences.installmentNumber,
      installmentTotal: occurrences.installmentTotal,
      status: occurrences.status,
    })
    .from(occurrences)
    .innerJoin(categories, eq(occurrences.categoryId, categories.id))
    .where(and(eq(occurrences.userId, userId), eq(occurrences.year, year), eq(occurrences.month, month)))
    .orderBy(asc(occurrences.dueDate), asc(occurrences.id));
}

export function computeMonthlySummaryFromRows(
  year: number,
  rows: OccurrenceRow[],
  initialInvested: number,
  investedYear: number
): Record<string, number> {
  const income = rows
    .filter((r) => r.type === ENTRY_INCOME)
    .reduce((s, r) => s + r.amountCents, 0);
  const expenses = rows
    .filter((r) => r.type !== ENTRY_INCOME)
    .reduce((s, r) => s + r.amountCents, 0);
  const paidExpenses = rows
    .filter((r) => r.type !== ENTRY_INCOME && r.status === STATUS_PAID)
    .reduce((s, r) => s + r.amountCents, 0);
  const openExpenses = rows
    .filter((r) => r.type !== ENTRY_INCOME && r.status === STATUS_UNPAID)
    .reduce((s, r) => s + r.amountCents, 0);
  const investedMonth = rows
    .filter((r) => r.type !== ENTRY_INCOME && r.category === "Investimento")
    .reduce((s, r) => s + r.amountCents, 0);

  return {
    initial_invested: year === ACTIVE_YEAR ? initialInvested : 0,
    income,
    expenses,
    paid_expenses: paidExpenses,
    open_expenses: openExpenses,
    invested_month: investedMonth,
    balance: income - expenses,
    invested_year: investedYear,
  };
}

export async function computeYearInvested(
  userId: number,
  year: number,
  initialInvested: number
): Promise<number> {
  const [result] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${occurrences.amountCents}), 0)`,
    })
    .from(occurrences)
    .innerJoin(categories, eq(occurrences.categoryId, categories.id))
    .where(
      and(
        eq(occurrences.userId, userId),
        eq(occurrences.year, year),
        eq(categories.name, "Investimento"),
        ne(occurrences.type, ENTRY_INCOME),
        eq(occurrences.status, STATUS_PAID)
      )
    );
  const initial = year === ACTIVE_YEAR ? initialInvested : 0;
  return initial + Number(result.total);
}

export async function computeMonthlyCategories(userId: number, year: number, month: number) {
  return db
    .select({
      category: categories.name,
      total: sql<number>`COALESCE(SUM(${occurrences.amountCents}), 0)`,
    })
    .from(occurrences)
    .innerJoin(categories, eq(occurrences.categoryId, categories.id))
    .where(
      and(
        eq(occurrences.userId, userId),
        eq(occurrences.year, year),
        eq(occurrences.month, month),
        ne(occurrences.type, ENTRY_INCOME)
      )
    )
    .groupBy(categories.name)
    .having(sql`SUM(${occurrences.amountCents}) > 0`)
    .orderBy(
      sql`SUM(${occurrences.amountCents}) DESC`,
      asc(categories.name)
    );
}

export async function computeYearlyTotals(userId: number, year: number) {
  const rows = await db
    .select({
      month: occurrences.month,
      income: sql<number>`SUM(CASE WHEN ${occurrences.type} = ${ENTRY_INCOME} THEN ${occurrences.amountCents} ELSE 0 END)`,
      expenses: sql<number>`SUM(CASE WHEN ${occurrences.type} != ${ENTRY_INCOME} THEN ${occurrences.amountCents} ELSE 0 END)`,
      invested: sql<number>`SUM(CASE WHEN ${occurrences.type} != ${ENTRY_INCOME} AND ${categories.name} = 'Investimento' THEN ${occurrences.amountCents} ELSE 0 END)`,
    })
    .from(occurrences)
    .innerJoin(categories, eq(occurrences.categoryId, categories.id))
    .where(and(eq(occurrences.userId, userId), eq(occurrences.year, year)))
    .groupBy(occurrences.month)
    .orderBy(asc(occurrences.month));

  const byMonth = new Map(rows.map((r) => [r.month, r]));

  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const row = byMonth.get(m);
    const income = Number(row?.income ?? 0);
    const expenses = Number(row?.expenses ?? 0);
    return {
      month: m,
      monthName: MONTH_NAMES[i],
      incomeCents: income,
      expensesCents: expenses,
      investedCents: Number(row?.invested ?? 0),
      balanceCents: income - expenses,
    };
  });
}

export async function createEntry(
  userId: number,
  entryType: string,
  name: string,
  amountCents: number,
  category: string,
  startDateIso: string,
  installments: number,
  statusOverride?: string
): Promise<void> {
  const categoryId = await getCategoryId(userId, category);
  if (!categoryId) throw new Error(`Categoria invalida: ${category}`);

  const [entry] = await db
    .insert(entries)
    .values({
      userId,
      type: entryType,
      name: name.trim(),
      totalAmountCents: amountCents,
      categoryId,
      startDate: startDateIso,
      installments,
      notes: "",
    })
    .returning({ id: entries.id });

  await insertOccurrences(
    userId,
    entry.id,
    categoryId,
    entryType,
    name.trim(),
    amountCents,
    startDateIso,
    installments,
    statusOverride
  );
}

async function insertOccurrences(
  userId: number,
  entryId: number,
  categoryId: number,
  entryType: string,
  name: string,
  amountCents: number,
  startDateIso: string,
  installments: number,
  statusOverride?: string
): Promise<void> {
  const [startYear, startMonth, startDay] = startDateIso.split("-").map(Number);
  const today = todayIso();

  if (entryType === ENTRY_FIXED) {
    if (startYear > ACTIVE_YEAR) return;
    const fromMonth = startYear === ACTIVE_YEAR ? startMonth : 1;
    for (let month = fromMonth; month <= 12; month++) {
      const d = Math.min(startDay, lastDayOfMonth(ACTIVE_YEAR, month));
      const dueDate = `${ACTIVE_YEAR}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const status = statusOverride ?? defaultStatusForDate(dueDate);
      await db.insert(occurrences).values({
        userId,
        entryId,
        categoryId,
        type: entryType,
        name,
        dueDate,
        year: ACTIVE_YEAR,
        month,
        amountCents,
        installmentNumber: null,
        installmentTotal: null,
        status,
        paidAt: status === STATUS_PAID ? today : null,
      });
    }
    return;
  }

  if (entryType === ENTRY_INSTALLMENT) {
    const amounts = splitAmount(amountCents, installments);
    for (let i = 0; i < installments; i++) {
      const dueDate = addMonths(startDateIso, i);
      const status = statusOverride ?? defaultStatusForDate(dueDate);
      await db.insert(occurrences).values({
        userId,
        entryId,
        categoryId,
        type: entryType,
        name,
        dueDate,
        year: parseInt(dueDate.slice(0, 4)),
        month: parseInt(dueDate.slice(5, 7)),
        amountCents: amounts[i],
        installmentNumber: i + 1,
        installmentTotal: installments,
        status,
        paidAt: status === STATUS_PAID ? today : null,
      });
    }
    return;
  }

  // Variable or Income
  const status = statusOverride ?? defaultStatusForDate(startDateIso);
  await db.insert(occurrences).values({
    userId,
    entryId,
    categoryId,
    type: entryType,
    name,
    dueDate: startDateIso,
    year: startYear,
    month: startMonth,
    amountCents,
    installmentNumber: null,
    installmentTotal: null,
    status,
    paidAt: status === STATUS_PAID ? today : null,
  });
}

export function serializeOccurrences(rows: OccurrenceRow[]) {
  return rows.map((row) => ({
    id: row.id,
    entryId: row.entryId,
    type: row.type,
    name: row.name,
    category: row.category,
    dueDate: row.dueDate,
    dateLabel: formatDateLabel(row.dueDate),
    amountCents: row.amountCents,
    amount: formatCents(row.amountCents),
    installment: installmentLabel(row.installmentNumber, row.installmentTotal),
    status: row.status,
  }));
}

function installmentLabel(
  number: number | null,
  total: number | null
): string {
  if (number && total) return `${number}/${total}`;
  return "";
}
