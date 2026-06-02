import type { Config } from "@netlify/functions";
import { and, eq, gte } from "drizzle-orm";
import { db } from "../../db/index.js";
import { entries, occurrences } from "../../db/schema.js";

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    // Accept both snake_case (desktop app) and camelCase (web app)
    const occurrenceId =
      typeof body.occurrence_id === "number"
        ? body.occurrence_id
        : typeof body.occurrenceId === "number"
          ? body.occurrenceId
          : NaN;
    const scope: string = body.scope ?? "all";

    if (isNaN(occurrenceId)) {
      return Response.json({ error: "ID invalido." }, { status: 400 });
    }

    const [row] = await db
      .select({
        id: occurrences.id,
        entryId: occurrences.entryId,
        dueDate: occurrences.dueDate,
      })
      .from(occurrences)
      .where(eq(occurrences.id, occurrenceId))
      .limit(1);

    if (!row) {
      return Response.json({ error: "Lancamento nao encontrado." }, { status: 404 });
    }

    if (scope === "single") {
      await db.delete(occurrences).where(eq(occurrences.id, occurrenceId));
    } else if (scope === "from") {
      await db
        .delete(occurrences)
        .where(
          and(eq(occurrences.entryId, row.entryId), gte(occurrences.dueDate, row.dueDate))
        );
    } else {
      // Delete the parent entry; cascade removes all occurrences
      await db.delete(entries).where(eq(entries.id, row.entryId));
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("api-delete error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/delete",
};
