import type { Config } from "@netlify/functions";
import { issueToken, publicUser, registerUser } from "./lib/auth.js";

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    const user = await registerUser(String(body.username ?? ""), String(body.password ?? ""));
    return Response.json(
      {
        token: issueToken(user),
        user: publicUser(user),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("api-register error:", err);
    return Response.json({ error: String(err) }, { status: 400 });
  }
};

export const config: Config = {
  path: "/api/auth/register",
};
