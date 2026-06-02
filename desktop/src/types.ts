export type MoneyValue = {
  cents: number;
  label: string;
};

export type Occurrence = {
  id: number;
  entryId: number;
  type: string;
  name: string;
  category: string;
  dueDate: string;
  dateLabel: string;
  amountCents: number;
  amount: string;
  installment: string;
  status: string;
};

export type CategoryTotal = {
  category: string;
  totalCents: number;
  total: string;
};

export type YearlyTotal = {
  month: number;
  monthName: string;
  incomeCents: number;
  expensesCents: number;
  investedCents: number;
  balanceCents: number;
};

export type FinanceState = {
  activeYear: number;
  selectedYear: number;
  selectedMonth: number;
  today: string;
  entryTypes: string[];
  statuses: string[];
  monthNames: string[];
  categories: string[];
  occurrences: Occurrence[];
  summary: Record<string, MoneyValue>;
  categoryTotals: CategoryTotal[];
  yearlyTotals: YearlyTotal[];
};

export type DeleteScope = "all" | "from" | "single";
