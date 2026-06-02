import type { Config, Context } from "@netlify/functions";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { occurrences } from "../../db/schema.js";
import { STATUS_PAID, STATUS_UNPAID } from "./lib/constants.js";
import { todayIso } from "./lib/dates.js";

export default async (req: Request, context: Context): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const id = parseInt(context.params.id);
  if (isNaN(id)) {
    return Response.json({ error: "ID invalido." }, { status: 400 });
  }

  try {
    const [row] = await db
      .select({ status: occurrences.status })
      .from(occurrences)
      .where(eq(occurrences.id, id))
      .limit(1);

    if (!row) {
      return Response.json({ error: "Lancamento nao encontrado." }, { status: 404 });
    }

    const newStatus = row.status === STATUS_PAID ? STATUS_UNPAID : STATUS_PAID;

    await db
      .update(occurrences)
      .set({
        status: newStatus,
        paidAt: newStatus === STATUS_PAID ? todayIso() : null,
      })
      .where(eq(occurrences.id, id));

    return Response.json({ status: newStatus });
  } catch (err) {
    console.error("api-toggle error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/occurrences/:id/toggle",
};
