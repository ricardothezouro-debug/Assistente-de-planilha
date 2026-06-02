import type { Config } from "@netlify/functions";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { users } from "../../db/schema.js";
import { getUserFromRequest, publicUser } from "./lib/auth.js";

export default async (req: Request): Promise<Response> => {
  try {
    const user = await getUserFromRequest(req);

    if (req.method === "GET") {
      return Response.json({ user: publicUser(user) });
    }

    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const body = await req.json();
    const displayName = String(body.displayName ?? "")
      .trim()
      .replace(/\s+/g, " ");

    if (displayName.length > 48) {
      return Response.json({ error: "Nome deve ter no maximo 48 caracteres." }, { status: 400 });
    }

    const [updated] = await db
      .update(users)
      .set({ displayName: displayName || null })
      .where(eq(users.id, user.id))
      .returning({ id: users.id, username: users.username, displayName: users.displayName });

    return Response.json({ user: publicUser({ ...user, displayName: updated.displayName }) });
  } catch (err) {
    console.error("api-profile error:", err);
    return Response.json({ error: String(err) }, { status: 400 });
  }
};

export const config: Config = {
  path: "/api/profile",
};
