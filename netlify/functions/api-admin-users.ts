import type { Config } from "@netlify/functions";
import { asc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { users } from "../../db/schema.js";
import { getUserFromRequest, parseFeatureFlags, requireAdmin } from "./lib/auth.js";

export default async (req: Request): Promise<Response> => {
  if (req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const admin = await getUserFromRequest(req);
    requireAdmin(admin);

    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        displayName: users.displayName,
        isAdmin: users.isAdmin,
        disabledAt: users.disabledAt,
        createdAt: users.createdAt,
        featureFlags: users.featureFlags,
      })
      .from(users)
      .orderBy(asc(users.id));

    return Response.json({
      users: rows.map((row) => ({
        id: row.id,
        username: row.username,
        email: row.email,
        displayName: row.displayName,
        isAdmin: row.isAdmin,
        disabledAt: row.disabledAt,
        createdAt: row.createdAt,
        features: parseFeatureFlags(row.featureFlags),
        isCurrentUser: row.id === admin.id,
      })),
    });
  } catch (err) {
    console.error("api-admin-users error:", err);
    return Response.json({ error: String(err) }, { status: 403 });
  }
};

export const config: Config = {
  path: "/api/admin/users",
};
