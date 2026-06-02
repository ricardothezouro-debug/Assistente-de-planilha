export const ACTIVE_YEAR = 2026;
export const INITIAL_INVESTED_CENTS = 600_000;
export const PAID_CUTOFF_ISO = "2026-05-31";

export const ENTRY_FIXED = "Fixa";
export const ENTRY_VARIABLE = "Variavel";
export const ENTRY_INSTALLMENT = "Parcela";
export const ENTRY_INCOME = "Recebido";
export const ENTRY_TYPES = [
  ENTRY_FIXED,
  ENTRY_VARIABLE,
  ENTRY_INSTALLMENT,
  ENTRY_INCOME,
] as const;

export const STATUS_PAID = "Pago";
export const STATUS_UNPAID = "Nao pago";

export const CATEGORIES = [
  "Comida",
  "Entretenimento",
  "Investimento",
  "Outros",
  "Casa",
  "Assinatura",
  "Saude",
  "Transporte",
] as const;

export const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Marco",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;
