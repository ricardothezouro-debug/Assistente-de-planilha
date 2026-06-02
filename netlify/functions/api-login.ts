import type { Config } from "@netlify/functions";
import { issueToken, loginUser } from "./lib/auth.js";

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    const user = await loginUser(String(body.username ?? ""), String(body.password ?? ""));
    return Response.json({
      token: issueToken(user),
      user: { username: user.username },
    });
  } catch (err) {
    console.error("api-login error:", err);
    return Response.json({ error: String(err) }, { status: 401 });
  }
};

export const config: Config = {
  path: "/api/auth/login",
};
