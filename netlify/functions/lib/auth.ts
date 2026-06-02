import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { sql, eq } from "drizzle-orm";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { db } from "../../../db/index.js";
import { users } from "../../../db/schema.js";
import { initializeDefaultsForUser, seedDefaultUserIfNeeded, DEFAULT_USERNAME } from "./seed.js";
import { supabaseAuth } from "./supabase.js";

const TOKEN_SECRET = process.env.AUTH_SECRET ?? "financeiro-local-dev-secret";
const LEGACY_OWNER_EMAIL = (process.env.LEGACY_OWNER_EMAIL ?? "").trim().toLowerCase();

export type AuthUser = {
  id: number;
  username: string;
  displayName: string | null;
};

export type PublicUser = {
  username: string;
  displayName: string | null;
  email?: string | null;
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

export function publicUser(user: AuthUser): PublicUser {
  return {
    username: user.username,
    displayName: user.displayName,
  };
}

export function isSupabaseToken(token: string): boolean {
  return token.split(".").length === 3;
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
      displayName: users.displayName,
    })
    .from(users)
    .where(eq(users.username, normalized))
    .limit(1);

  if (!row || row.passwordHash !== hashPassword(password)) {
    throw new Error("Usuario ou senha invalidos.");
  }

  return { id: row.id, username: row.username, displayName: row.displayName };
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
    .returning({ id: users.id, username: users.username, displayName: users.displayName });

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

  if (isSupabaseToken(token)) {
    return getUserFromSupabaseToken(token);
  }

  return getUserFromLegacyToken(token);
}

async function getUserFromSupabaseToken(token: string): Promise<AuthUser> {
  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data.user) {
    throw new Error("Sessao invalida.");
  }

  await seedDefaultUserIfNeeded();
  return getOrCreateAppUser(data.user);
}

async function getOrCreateAppUser(authUser: SupabaseUser): Promise<AuthUser> {
  const supabaseUserId = authUser.id;
  const email = authUser.email?.trim().toLowerCase() ?? "";
  const displayName = normalizeDisplayName(
    authUser.user_metadata?.display_name ??
      authUser.user_metadata?.full_name ??
      authUser.user_metadata?.name ??
      ""
  );

  const [linked] = await db
    .select({ id: users.id, username: users.username, displayName: users.displayName })
    .from(users)
    .where(eq(users.supabaseUserId, supabaseUserId))
    .limit(1);

  if (linked) return linked;

  const legacyOwnerEmail = LEGACY_OWNER_EMAIL;
  if (legacyOwnerEmail && email === legacyOwnerEmail) {
    const [legacy] = await db
      .update(users)
      .set({ supabaseUserId, displayName: displayName || null })
      .where(eq(users.username, DEFAULT_USERNAME))
      .returning({ id: users.id, username: users.username, displayName: users.displayName });

    if (legacy) {
      await initializeDefaultsForUser(legacy.id, 0);
      return legacy;
    }
  }

  const username = await nextAvailableUsername(usernameFromSupabase(authUser));
  const [created] = await db
    .insert(users)
    .values({
      username,
      supabaseUserId,
      passwordHash: "supabase-auth",
      displayName: displayName || null,
    })
    .returning({ id: users.id, username: users.username, displayName: users.displayName });

  await initializeDefaultsForUser(created.id, 0);
  return created;
}

async function nextAvailableUsername(base: string): Promise<string> {
  const cleanBase = base || "usuario";
  for (let attempt = 0; attempt < 100; attempt++) {
    const username = attempt === 0 ? cleanBase : `${cleanBase}-${attempt + 1}`;
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    if (rows.length === 0) return username;
  }
  return `usuario-${Date.now()}`;
}

function usernameFromSupabase(authUser: SupabaseUser): string {
  const metadataUsername = String(authUser.user_metadata?.username ?? "").trim().toLowerCase();
  if (/^[a-z0-9_.-]{3,32}$/.test(metadataUsername)) {
    return metadataUsername;
  }

  const emailLocal = authUser.email?.split("@")[0] ?? "";
  const sanitized = emailLocal.toLowerCase().replace(/[^a-z0-9_.-]/g, "-").replace(/-+/g, "-");
  if (sanitized.length >= 3) return sanitized.slice(0, 32);
  return `usuario-${authUser.id.slice(0, 8)}`;
}

function normalizeDisplayName(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 48);
}

async function getUserFromLegacyToken(token: string): Promise<AuthUser> {
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
    .select({ id: users.id, username: users.username, displayName: users.displayName })
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
