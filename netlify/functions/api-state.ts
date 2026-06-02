import type { Config } from "@netlify/functions";
import { ACTIVE_YEAR, ENTRY_TYPES, MONTH_NAMES } from "./lib/constants.js";
import { formatCents, serializeMoneyMap } from "./lib/money.js";
import {
  computeMonthlyCategories,
  computeMonthlySummaryFromRows,
  computeYearInvested,
  computeYearlyTotals,
  getCategoryItems,
  getInitialInvestedCents,
  listOccurrences,
  serializeOccurrences,
} from "./lib/finance.js";
import { todayIso } from "./lib/dates.js";
import { getUserFromRequest, publicUser } from "./lib/auth.js";
import { initializeDefaultsForUser } from "./lib/seed.js";

export default async (req: Request): Promise<Response> => {
  try {
    const user = await getUserFromRequest(req);
    await initializeDefaultsForUser(user.id, 0);

    const url = new URL(req.url);
    const year = parseInt(url.searchParams.get("year") ?? String(ACTIVE_YEAR));
    const today = todayIso();
    const todayMonth = parseInt(today.slice(5, 7));
    const todayYear = parseInt(today.slice(0, 4));
    const month = parseInt(
      url.searchParams.get("month") ?? String(todayYear === ACTIVE_YEAR ? todayMonth : 1)
    );

    const [occurrenceRows, categoryTotals, yearlyTotals, categoryItems, initialInvested] =
      await Promise.all([
        listOccurrences(user.id, year, month),
        computeMonthlyCategories(user.id, year, month),
        computeYearlyTotals(user.id, year),
        getCategoryItems(user.id),
        getInitialInvestedCents(user.id),
      ]);

    const investedYear = await computeYearInvested(user.id, year, initialInvested);
    const summary = computeMonthlySummaryFromRows(year, occurrenceRows, initialInvested, investedYear);

    return Response.json({
      activeYear: ACTIVE_YEAR,
      selectedYear: year,
      selectedMonth: month,
      today,
      entryTypes: [...ENTRY_TYPES],
      statuses: ["Auto", "Pago", "Nao pago"],
      monthNames: [...MONTH_NAMES],
      categories: categoryItems.map((category) => category.name),
      categoryItems,
      occurrences: serializeOccurrences(occurrenceRows),
      summary: serializeMoneyMap(summary),
      categoryTotals: categoryTotals.map((row) => ({
        category: row.category,
        totalCents: Number(row.total),
        total: formatCents(Number(row.total)),
      })),
      yearlyTotals,
      user: publicUser(user),
    });
  } catch (err) {
    console.error("api-state error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/state",
};
