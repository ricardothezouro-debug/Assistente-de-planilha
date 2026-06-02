import type { Config } from "@netlify/functions";
import { and, sql, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { categories } from "../../db/schema.js";
import { getUserFromRequest } from "./lib/auth.js";

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const user = await getUserFromRequest(req);
    const body = await req.json();
    const name = String(body.name ?? "")
      .trim()
      .replace(/\s+/g, " ");

    if (!name) {
      return Response.json({ error: "Informe o nome da categoria." }, { status: 400 });
    }

    // Find existing (case-insensitive)
    const existing = await db
      .select({ name: categories.name })
      .from(categories)
      .where(and(eq(categories.userId, user.id), sql`lower(${categories.name}) = lower(${name})`))
      .limit(1);

    if (existing.length > 0) {
      return Response.json({ category: existing[0].name }, { status: 201 });
    }

    await db.insert(categories).values({ userId: user.id, name });
    return Response.json({ category: name }, { status: 201 });
  } catch (err) {
    console.error("api-categories error:", err);
    return Response.json({ error: String(err) }, { status: 400 });
  }
};

export const config: Config = {
  path: "/api/categories",
};
