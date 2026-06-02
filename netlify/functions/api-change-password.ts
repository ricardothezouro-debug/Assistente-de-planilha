import type { Config } from "@netlify/functions";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { users } from "../../db/schema.js";
import { getUserFromRequest, hashPassword } from "./lib/auth.js";

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const user = await getUserFromRequest(req);
    const body = await req.json();
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");

    if (!newPassword.trim()) {
      return Response.json({ error: "Informe a nova senha." }, { status: 400 });
    }

    const [row] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (!row || row.passwordHash !== hashPassword(currentPassword)) {
      return Response.json({ error: "Senha atual invalida." }, { status: 401 });
    }

    await db
      .update(users)
      .set({ passwordHash: hashPassword(newPassword) })
      .where(eq(users.id, user.id));

    return Response.json({ ok: true });
  } catch (err) {
    console.error("api-change-password error:", err);
    return Response.json({ error: String(err) }, { status: 400 });
  }
};

export const config: Config = {
  path: "/api/profile/password",
};
