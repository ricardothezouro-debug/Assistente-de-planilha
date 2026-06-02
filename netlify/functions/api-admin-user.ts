import type { Config, Context } from "@netlify/functions";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { users } from "../../db/schema.js";
import { getUserFromRequest, parseFeatureFlags, requireAdmin } from "./lib/auth.js";

export default async (req: Request, context: Context): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const id = parseInt(context.params.id);
  if (isNaN(id)) {
    return Response.json({ error: "ID invalido." }, { status: 400 });
  }

  try {
    const admin = await getUserFromRequest(req);
    requireAdmin(admin);

    const body = await req.json();
    const action = String(body.action ?? "");

    if (action === "disable") {
      if (id === admin.id) {
        return Response.json({ error: "Voce nao pode desativar sua propria conta." }, { status: 400 });
      }
      await db.update(users).set({ disabledAt: new Date() }).where(eq(users.id, id));
      return Response.json({ ok: true });
    }

    if (action === "enable") {
      await db.update(users).set({ disabledAt: null }).where(eq(users.id, id));
      return Response.json({ ok: true });
    }

    if (action === "feature") {
      const key = String(body.key ?? "").trim();
      const enabled = Boolean(body.enabled);
      if (!/^[a-z0-9_.-]{1,48}$/.test(key)) {
        return Response.json({ error: "Feature invalida." }, { status: 400 });
      }

      const [target] = await db
        .select({ featureFlags: users.featureFlags })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (!target) {
        return Response.json({ error: "Usuario nao encontrado." }, { status: 404 });
      }

      const nextFeatures = {
        ...parseFeatureFlags(target.featureFlags),
        [key]: enabled,
      };

      await db
        .update(users)
        .set({ featureFlags: JSON.stringify(nextFeatures) })
        .where(eq(users.id, id));

      return Response.json({ ok: true, features: nextFeatures });
    }

    return Response.json({ error: "Acao invalida." }, { status: 400 });
  } catch (err) {
    console.error("api-admin-user error:", err);
    return Response.json({ error: String(err) }, { status: 403 });
  }
};

export const config: Config = {
  path: "/api/admin/users/:id",
};
