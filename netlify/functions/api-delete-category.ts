import type { Config, Context } from "@netlify/functions";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { categories, entries, occurrences } from "../../db/schema.js";
import { getUserFromRequest } from "./lib/auth.js";
import { CATEGORIES } from "./lib/constants.js";

export default async (req: Request, context: Context): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const id = parseInt(context.params.id);
  if (isNaN(id)) {
    return Response.json({ error: "ID invalido." }, { status: 400 });
  }

  try {
    const user = await getUserFromRequest(req);
    const [category] = await db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, user.id)))
      .limit(1);

    if (!category) {
      return Response.json({ error: "Categoria nao encontrada." }, { status: 404 });
    }

    if ((CATEGORIES as readonly string[]).includes(category.name)) {
      return Response.json({ error: "Categorias padrao nao podem ser removidas." }, { status: 400 });
    }

    const [usage] = await db
      .select({
        entryCount: sql<number>`COUNT(DISTINCT ${entries.id})`,
        occurrenceCount: sql<number>`COUNT(DISTINCT ${occurrences.id})`,
      })
      .from(categories)
      .leftJoin(entries, and(eq(entries.categoryId, categories.id), eq(entries.userId, user.id)))
      .leftJoin(
        occurrences,
        and(eq(occurrences.categoryId, categories.id), eq(occurrences.userId, user.id))
      )
      .where(and(eq(categories.id, id), eq(categories.userId, user.id)));

    if (Number(usage?.entryCount ?? 0) > 0 || Number(usage?.occurrenceCount ?? 0) > 0) {
      return Response.json(
        { error: "Esta categoria ja esta em uso em lancamentos." },
        { status: 400 }
      );
    }

    await db
      .delete(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, user.id)));

    return Response.json({ ok: true });
  } catch (err) {
    console.error("api-delete-category error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/categories/:id/delete",
};
