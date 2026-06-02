import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { and, sql, eq } from "drizzle-orm";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { db } from "../../../db/index.js";
import { users } from "../../../db/schema.js";
import { initializeDefaultsForUser, seedDefaultUserIfNeeded, DEFAULT_USERNAME } from "./seed.js";
import { supabaseAuth } from "./supabase.js";

const TOKEN_SECRET = process.env.AUTH_SECRET ?? "financeiro-local-dev-secret";
const LEGACY_OWNER_EMAIL = (process.env.LEGACY_OWNER_EMAIL ?? "").trim().toLowerCase();
export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "gamoxkun@gmail.com").trim().toLowerCase();

export type FeatureFlags = Record<string, boolean>;

export type AuthUser = {
  id: number;
  username: string;
  email: string | null;
  displayName: string | null;
  isAdmin: boolean;
  disabledAt: Date | null;
  features: FeatureFlags;
};

export type PublicUser = {
  username: string;
  displayName: string | null;
  email: string | null;
  isAdmin: boolean;
  features: FeatureFlags;
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
    email: user.email,
    isAdmin: user.isAdmin,
    features: user.features,
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
      email: users.email,
      passwordHash: users.passwordHash,
      displayName: users.displayName,
      isAdmin: users.isAdmin,
      disabledAt: users.disabledAt,
      featureFlags: users.featureFlags,
    })
    .from(users)
    .where(eq(users.username, normalized))
    .limit(1);

  if (!row || row.passwordHash !== hashPassword(password)) {
    throw new Error("Usuario ou senha invalidos.");
  }

  return authUserFromRow(row);
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
    .returning(authUserSelect());

  await initializeDefaultsForUser(created.id, 0);
  return authUserFromRow(created);
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
    .select(authUserSelect())
    .from(users)
    .where(eq(users.supabaseUserId, supabaseUserId))
    .limit(1);

  if (linked) {
    const updated = await syncSupabaseUserRow(linked.id, {
      email,
      displayName,
      isAdmin: email === ADMIN_EMAIL,
    });
    return assertAccountActive(updated);
  }

  if (email) {
    const [existingEmail] = await db
      .select(authUserSelect())
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingEmail) {
      const [updated] = await db
        .update(users)
        .set({
          supabaseUserId,
          isAdmin: existingEmail.isAdmin || email === ADMIN_EMAIL,
          displayName: displayName || undefined,
        })
        .where(eq(users.id, existingEmail.id))
        .returning(authUserSelect());

      return assertAccountActive(authUserFromRow(updated));
    }
  }

  const legacyOwnerEmail = LEGACY_OWNER_EMAIL;
  if (legacyOwnerEmail && email === legacyOwnerEmail) {
    const [legacy] = await db
      .update(users)
      .set({
        supabaseUserId,
        email: email || null,
        displayName: displayName || null,
        isAdmin: email === ADMIN_EMAIL,
      })
      .where(and(eq(users.username, DEFAULT_USERNAME), sql`${users.supabaseUserId} IS NULL`))
      .returning(authUserSelect());

    if (legacy) {
      await initializeDefaultsForUser(legacy.id, 0);
      return assertAccountActive(authUserFromRow(legacy));
    }
  }

  const username = await nextAvailableUsername(usernameFromSupabase(authUser));
  const [created] = await db
    .insert(users)
    .values({
      username,
      supabaseUserId,
      email: email || null,
      passwordHash: "supabase-auth",
      displayName: displayName || null,
      isAdmin: email === ADMIN_EMAIL,
    })
    .returning(authUserSelect());

  await initializeDefaultsForUser(created.id, 0);
  return assertAccountActive(authUserFromRow(created));
}

async function syncSupabaseUserRow(
  id: number,
  input: { email: string; displayName: string; isAdmin: boolean }
): Promise<AuthUser> {
  const [updated] = await db
    .update(users)
    .set({
      email: input.email || null,
      isAdmin: input.isAdmin,
      displayName: input.displayName || undefined,
    })
    .where(eq(users.id, id))
    .returning(authUserSelect());

  return authUserFromRow(updated);
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
    .select(authUserSelect())
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!row || row.username !== username) {
    throw new Error("Sessao invalida.");
  }

  return assertAccountActive(authUserFromRow(row));
}

export function requireAdmin(user: AuthUser): void {
  if (!user.isAdmin) {
    throw new Error("Acesso de admin necessario.");
  }
}

function authUserSelect() {
  return {
    id: users.id,
    username: users.username,
    email: users.email,
    displayName: users.displayName,
    isAdmin: users.isAdmin,
    disabledAt: users.disabledAt,
    featureFlags: users.featureFlags,
  };
}

function authUserFromRow(row: {
  id: number;
  username: string;
  email: string | null;
  displayName: string | null;
  isAdmin: boolean;
  disabledAt: Date | null;
  featureFlags: string;
}): AuthUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.displayName,
    isAdmin: row.isAdmin,
    disabledAt: row.disabledAt,
    features: parseFeatureFlags(row.featureFlags),
  };
}

function assertAccountActive(user: AuthUser): AuthUser {
  if (user.disabledAt) {
    throw new Error("Conta desativada pelo admin.");
  }
  return user;
}

export function parseFeatureFlags(value: string | null): FeatureFlags {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).map(([key, enabled]) => [key, Boolean(enabled)])
    );
  } catch {
    return {};
  }
}

function signPayload(payload: string): string {
  return createHmac("sha256", TOKEN_SECRET).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
