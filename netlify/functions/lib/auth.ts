import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { sql, eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { users } from "../../../db/schema.js";
import { initializeDefaultsForUser, seedDefaultUserIfNeeded } from "./seed.js";

const TOKEN_SECRET = process.env.AUTH_SECRET ?? "financeiro-local-dev-secret";

export type AuthUser = {
  id: number;
  username: string;
};

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

function validateUsername(username: string): void {
  if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
    throw new Error("Usuario deve ter 3 a 32 caracteres: letras, numeros, ponto, hifen ou underline.");
  }
}

export function hashPassword(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function loginUser(username: string, password: string): Promise<AuthUser> {
  await seedDefaultUserIfNeeded();
  const normalized = normalizeUsername(username);
  validateUsername(normalized);
  const [row] = await db
    .select({
      id: users.id,
      username: users.username,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.username, normalized))
    .limit(1);

  if (!row || row.passwordHash !== hashPassword(password)) {
    throw new Error("Usuario ou senha invalidos.");
  }

  return { id: row.id, username: row.username };
}

export async function registerUser(username: string, password: string): Promise<AuthUser> {
  await seedDefaultUserIfNeeded();
  const normalized = normalizeUsername(username);
  validateUsername(normalized);
  if (!password.trim()) {
    throw new Error("Informe uma senha.");
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.username}) = lower(${normalized})`)
    .limit(1);

  if (existing.length > 0) {
    throw new Error("Usuario ja existe.");
  }

  const [created] = await db
    .insert(users)
    .values({ username: normalized, passwordHash: hashPassword(password) })
    .returning({ id: users.id, username: users.username });

  await initializeDefaultsForUser(created.id, 0);
  return created;
}

export function issueToken(user: AuthUser): string {
  const payload = `${user.id}:${user.username}`;
  const signature = signPayload(payload);
  return Buffer.from(`${payload}:${signature}`, "utf8").toString("base64url");
}

export async function getUserFromRequest(req: Request): Promise<AuthUser> {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  if (!token) {
    throw new Error("Login necessario.");
  }

  let decoded = "";
  try {
    decoded = Buffer.from(token, "base64url").toString("utf8");
  } catch {
    throw new Error("Sessao invalida.");
  }

  const [idText, username, signature] = decoded.split(":");
  const id = Number(idText);
  if (!id || !username || !signature) {
    throw new Error("Sessao invalida.");
  }

  const expected = signPayload(`${id}:${username}`);
  if (!safeEqual(signature, expected)) {
    throw new Error("Sessao invalida.");
  }

  const [row] = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!row || row.username !== username) {
    throw new Error("Sessao invalida.");
  }

  return row;
}

function signPayload(payload: string): string {
  return createHmac("sha256", TOKEN_SECRET).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
