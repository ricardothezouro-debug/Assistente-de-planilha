import type { Config } from "@netlify/functions";
import { ENTRY_TYPES, ENTRY_INSTALLMENT } from "./lib/constants.js";
import { parseMoneyCents } from "./lib/money.js";
import { parseUserDate } from "./lib/dates.js";
import { createEntry } from "./lib/finance.js";
import { getUserFromRequest } from "./lib/auth.js";

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const user = await getUserFromRequest(req);
    const body = await req.json();
    const { type, name, amount, category, date, installments, status } = body;

    if (!(ENTRY_TYPES as readonly string[]).includes(type)) {
      return Response.json({ error: `Tipo invalido: ${type}` }, { status: 400 });
    }
    if (!String(name ?? "").trim()) {
      return Response.json({ error: "Informe uma descricao." }, { status: 400 });
    }

    const amountCents = parseMoneyCents(String(amount));
    if (amountCents <= 0) {
      return Response.json({ error: "O valor deve ser maior que zero." }, { status: 400 });
    }

    const startDateIso = parseUserDate(String(date));
    const numInstallments =
      type === ENTRY_INSTALLMENT ? Math.max(1, parseInt(installments ?? "1")) : 1;

    if (type === ENTRY_INSTALLMENT && numInstallments <= 1) {
      return Response.json(
        { error: "Parcelas precisam ter pelo menos 2 vezes." },
        { status: 400 }
      );
    }

    const statusOverride =
      !status || status === "Auto" ? undefined : String(status);

    await createEntry(
      user.id,
      type,
      String(name),
      amountCents,
      String(category),
      startDateIso,
      numInstallments,
      statusOverride
    );

    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("api-entries error:", err);
    return Response.json({ error: String(err) }, { status: 400 });
  }
};

export const config: Config = {
  path: "/api/entries",
};
