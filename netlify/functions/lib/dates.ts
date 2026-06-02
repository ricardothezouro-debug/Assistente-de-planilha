import { ACTIVE_YEAR, PAID_CUTOFF_ISO, STATUS_PAID, STATUS_UNPAID } from "./constants.js";

export function parseUserDate(value: string): string {
  const text = value.trim();
  if (!text) throw new Error("Informe uma data.");

  let m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }

  m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (m) {
    return `${2000 + parseInt(m[3])}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }

  m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return text;

  m = text.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (m) {
    return `${ACTIVE_YEAR}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }

  throw new Error("Data invalida. Use dd/mm/aaaa ou dd/mm.");
}

export function addMonths(dateIso: string, months: number): string {
  const [y, mo, d] = dateIso.split("-").map(Number);
  const totalMonths = y * 12 + (mo - 1) + months;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;
  const lastDay = new Date(newYear, newMonth, 0).getDate();
  const newDay = Math.min(d, lastDay);
  return `${newYear}-${String(newMonth).padStart(2, "0")}-${String(newDay).padStart(2, "0")}`;
}

export function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function defaultStatusForDate(dueDateIso: string): string {
  return dueDateIso <= PAID_CUTOFF_ISO ? STATUS_PAID : STATUS_UNPAID;
}

export function formatDateLabel(dueDateIso: string): string {
  const [year, month, day] = dueDateIso.split("-");
  return `${day}/${month}/${year}`;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
