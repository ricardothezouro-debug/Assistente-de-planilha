export function parseMoneyCents(value: string): number {
  let raw = value.trim().replace("R$", "").replace(/ /g, "");
  if (!raw) throw new Error("Informe um valor.");

  if (raw.includes(",")) {
    raw = raw.replace(/\./g, "").replace(",", ".");
  } else if (raw.includes(".")) {
    const lastGroup = raw.split(".").pop()!;
    if (lastGroup.length === 3) raw = raw.replace(/\./g, "");
  }

  const n = parseFloat(raw);
  if (isNaN(n)) throw new Error(`Valor invalido: ${value}`);
  return Math.round(n * 100);
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const reais = Math.floor(abs / 100);
  const centavos = abs % 100;
  const inteiro = reais.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}R$ ${inteiro},${centavos.toString().padStart(2, "0")}`;
}

export function splitAmount(totalCents: number, parts: number): number[] {
  const base = Math.floor(totalCents / parts);
  const remainder = totalCents % parts;
  const amounts = new Array<number>(parts).fill(base);
  amounts[amounts.length - 1] += remainder;
  return amounts;
}

export function serializeMoneyMap(
  values: Record<string, number>
): Record<string, { cents: number; label: string }> {
  return Object.fromEntries(
    Object.entries(values).map(([k, v]) => [k, { cents: v, label: formatCents(v) }])
  );
}
