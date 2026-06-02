import type { Config } from "@netlify/functions";
import { parseMoneyCents } from "./lib/money.js";
import { setInitialInvestedCents } from "./lib/finance.js";

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    const cents = parseMoneyCents(String(body.amount ?? ""));

    if (cents < 0) {
      return Response.json(
        { error: "O valor investido inicial nao pode ser negativo." },
        { status: 400 }
      );
    }

    await setInitialInvestedCents(cents);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("api-initial-invested error:", err);
    return Response.json({ error: String(err) }, { status: 400 });
  }
};

export const config: Config = {
  path: "/api/settings/initial-invested",
};
