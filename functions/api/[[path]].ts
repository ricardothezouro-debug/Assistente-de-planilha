type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  LEGACY_OWNER_EMAIL?: string;
  ADMIN_EMAIL?: string;
};

type Context = {
  request: Request;
  env: Env;
};

type SupabaseClient = SupabaseRestClient;

type SupabaseAuthUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

type AppUser = {
  id: number;
  username: string;
  email: string | null;
  displayName: string | null;
  isAdmin: boolean;
  disabledAt: string | null;
  features: Record<string, boolean>;
};

type OccurrenceRow = {
  id: number;
  entryId: number;
  type: string;
  name: string;
  category: string;
  dueDate: string;
  amountCents: number;
  installmentNumber: number | null;
  installmentTotal: number | null;
  status: string;
};

const ACTIVE_YEAR = 2026;
const INITIAL_INVESTED_CENTS = 600_000;
const PAID_CUTOFF_ISO = "2026-05-31";
const DEFAULT_USERNAME = "gamoxkun";

const ENTRY_FIXED = "Fixa";
const ENTRY_VARIABLE = "Variavel";
const ENTRY_INSTALLMENT = "Parcela";
const ENTRY_INCOME = "Recebido";
const ENTRY_TYPES = [ENTRY_FIXED, ENTRY_VARIABLE, ENTRY_INSTALLMENT, ENTRY_INCOME] as const;

const STATUS_PAID = "Pago";
const STATUS_UNPAID = "Nao pago";

const CATEGORIES = [
  "Comida",
  "Entretenimento",
  "Investimento",
  "Outros",
  "Casa",
  "Assinatura",
  "Saude",
  "Transporte",
] as const;

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Marco",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

const INITIAL_ENTRIES = [
  { type: ENTRY_FIXED, name: "Vivo", amountCents: 4300, category: "Assinatura", startDate: "2026-02-01", installments: 1 },
  { type: ENTRY_FIXED, name: "Mei", amountCents: 8090, category: "Outros", startDate: "2026-02-01", installments: 1 },
  { type: ENTRY_FIXED, name: "YouTube Premium", amountCents: 2690, category: "Assinatura", startDate: "2026-02-01", installments: 1 },
  { type: ENTRY_FIXED, name: "Crunchyroll", amountCents: 1999, category: "Assinatura", startDate: "2026-02-01", installments: 1 },
  { type: ENTRY_FIXED, name: "Google One", amountCents: 999, category: "Assinatura", startDate: "2026-02-01", installments: 1 },
  { type: ENTRY_FIXED, name: "Cap cut", amountCents: 3290, category: "Assinatura", startDate: "2026-02-01", installments: 1 },
  { type: ENTRY_INSTALLMENT, name: "Celular", amountCents: 323100, category: "Outros", startDate: "2026-01-01", installments: 9 },
  { type: ENTRY_INSTALLMENT, name: "Cadeira gamer", amountCents: 77924, category: "Casa", startDate: "2026-01-01", installments: 4 },
  { type: ENTRY_INSTALLMENT, name: "Jogo Pokemon", amountCents: 25732, category: "Entretenimento", startDate: "2026-01-01", installments: 4 },
  { type: ENTRY_INSTALLMENT, name: "Viagem", amountCents: 121704, category: "Entretenimento", startDate: "2026-01-01", installments: 2 },
  { type: ENTRY_INSTALLMENT, name: "Silent hill F", amountCents: 22038, category: "Entretenimento", startDate: "2026-01-01", installments: 2 },
  { type: ENTRY_INSTALLMENT, name: "Resident evil", amountCents: 35180, category: "Entretenimento", startDate: "2026-04-01", installments: 4 },
] as const;

export async function onRequest(context: Context): Promise<Response> {
  try {
    const request = context.request;
    const method = request.method.toUpperCase();
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api\/?/, "");
    const segments = path.split("/").filter(Boolean);
    const db = serviceDb(context.env);

    if (method === "POST" && segments.join("/") === "auth/login") {
      return forbiddenLegacyAuth();
    }
    if (method === "POST" && segments.join("/") === "auth/register") {
      return forbiddenLegacyAuth();
    }

    const user = await getUserFromRequest(request, context.env, db);

    if (method === "GET" && segments[0] === "state") {
      return json(await getState(db, user, url));
    }
    if (method === "POST" && segments[0] === "entries") {
      return createEntryEndpoint(db, user, await request.json());
    }
    if (method === "POST" && segments[0] === "categories" && segments.length === 1) {
      return createCategoryEndpoint(db, user, await request.json());
    }
    if (method === "POST" && segments[0] === "categories" && segments[2] === "delete") {
      return deleteCategoryEndpoint(db, user, Number(segments[1]));
    }
    if (method === "POST" && segments[0] === "occurrences" && segments[2] === "toggle") {
      return toggleOccurrenceEndpoint(db, user, Number(segments[1]));
    }
    if (method === "POST" && segments[0] === "delete") {
      return deleteOccurrenceEndpoint(db, user, await request.json());
    }
    if (method === "POST" && segments.join("/") === "settings/initial-invested") {
      return updateInitialInvestedEndpoint(db, user, await request.json());
    }
    if (segments[0] === "profile") {
      if (method === "GET" && segments.length === 1) return json({ user: publicUser(user) });
      if (method === "POST" && segments.length === 1) return updateProfileEndpoint(db, user, await request.json());
    }
    if (method === "GET" && segments.join("/") === "admin/users") {
      return listAdminUsersEndpoint(db, user);
    }
    if (method === "POST" && segments[0] === "admin" && segments[1] === "users" && segments[2]) {
      return adminUserActionEndpoint(db, user, Number(segments[2]), await request.json());
    }

    return json({ error: "Rota nao encontrada." }, 404);
  } catch (err) {
    console.error("cloudflare api error:", err);
    return json({ error: normalizeError(err) }, inferStatus(err));
  }
}

function serviceDb(env: Env) {
  assertEnv(env, "SUPABASE_URL");
  assertEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  if (
    env.SUPABASE_SERVICE_ROLE_KEY === env.SUPABASE_ANON_KEY ||
    env.SUPABASE_SERVICE_ROLE_KEY.startsWith("sb_publishable_")
  ) {
    throw statusError("Configure SUPABASE_SERVICE_ROLE_KEY com a chave secreta service_role do Supabase.", 500);
  }
  return new SupabaseRestClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

async function getAuthUser(env: Env, token: string): Promise<SupabaseAuthUser> {
  assertEnv(env, "SUPABASE_URL");
  assertEnv(env, "SUPABASE_ANON_KEY");
  const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) throw statusError("Sessao invalida.", 401);
  return response.json();
}

async function getUserFromRequest(request: Request, env: Env, db: SupabaseClient): Promise<AppUser> {
  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  if (!token) throw statusError("Login necessario.", 401);

  const authUser = await getAuthUser(env, token);

  await seedDefaultUserIfNeeded(db);
  const user = await getOrCreateAppUser(db, env, authUser);
  if (user.disabledAt) throw statusError("Conta desativada pelo admin.", 403);
  return user;
}

async function getOrCreateAppUser(db: SupabaseClient, env: Env, authUser: SupabaseAuthUser): Promise<AppUser> {
  const supabaseUserId = authUser.id;
  const email = authUser.email?.trim().toLowerCase() ?? "";
  const adminEmail = getAdminEmail(env);
  const legacyOwnerEmail = (env.LEGACY_OWNER_EMAIL?.trim().toLowerCase() || adminEmail);
  const displayName = normalizeDisplayName(
    authUser.user_metadata?.display_name ??
      authUser.user_metadata?.full_name ??
      authUser.user_metadata?.name ??
      ""
  );

  const linked = await maybeSingle<AppUserRow>(
    db.from("users").select(userSelect()).eq("supabase_user_id", supabaseUserId).limit(1)
  );
  if (linked) {
    const nextDisplay = linked.display_name || displayName || null;
    const updated = await single<AppUserRow>(
      db
        .from("users")
        .update({ email: email || null, is_admin: email === adminEmail, display_name: nextDisplay })
        .eq("id", linked.id)
        .select(userSelect())
    );
    return mapUser(updated);
  }

  if (email) {
    const existingEmail = await maybeSingle<AppUserRow>(
      db.from("users").select(userSelect()).eq("email", email).limit(1)
    );
    if (existingEmail) {
      const updated = await single<AppUserRow>(
        db
          .from("users")
          .update({
            supabase_user_id: supabaseUserId,
            is_admin: existingEmail.is_admin || email === adminEmail,
            display_name: existingEmail.display_name || displayName || null,
          })
          .eq("id", existingEmail.id)
          .select(userSelect())
      );
      return mapUser(updated);
    }
  }

  if (email && email === legacyOwnerEmail) {
    const legacy = await maybeSingle<AppUserRow>(
      db.from("users").select(userSelect()).eq("username", DEFAULT_USERNAME).is("supabase_user_id", null).limit(1)
    );
    if (legacy) {
      const updated = await single<AppUserRow>(
        db
          .from("users")
          .update({
            supabase_user_id: supabaseUserId,
            email,
            is_admin: email === adminEmail,
            display_name: legacy.display_name || displayName || null,
          })
          .eq("id", legacy.id)
          .select(userSelect())
      );
      await initializeDefaultsForUser(db, updated.id, INITIAL_INVESTED_CENTS);
      return mapUser(updated);
    }
  }

  const username = await nextAvailableUsername(db, usernameFromSupabase(authUser));
  const created = await single<AppUserRow>(
    db
      .from("users")
      .insert({
        username,
        supabase_user_id: supabaseUserId,
        email: email || null,
        password_hash: "supabase-auth",
        display_name: displayName || null,
        is_admin: email === adminEmail,
      })
      .select(userSelect())
  );
  await initializeDefaultsForUser(db, created.id, 0);
  return mapUser(created);
}

async function getState(db: SupabaseClient, user: AppUser, url: URL) {
  const year = parseInt(url.searchParams.get("year") ?? String(ACTIVE_YEAR));
  const today = todayIso();
  const todayMonth = parseInt(today.slice(5, 7));
  const todayYear = parseInt(today.slice(0, 4));
  const month = parseInt(url.searchParams.get("month") ?? String(todayYear === ACTIVE_YEAR ? todayMonth : 1));

  const [occurrences, categoryItems, initialInvested, yearlyRows] = await Promise.all([
    listOccurrences(db, user.id, year, month),
    getCategoryItems(db, user.id),
    getInitialInvestedCents(db, user.id),
    listYearOccurrences(db, user.id, year),
  ]);
  const investedYear = computeYearInvested(yearlyRows, year, initialInvested);
  const summary = computeMonthlySummaryFromRows(year, occurrences, initialInvested, investedYear);
  const categoryTotals = computeMonthlyCategories(occurrences);
  const yearlyTotals = computeYearlyTotals(yearlyRows);

  return {
    activeYear: ACTIVE_YEAR,
    selectedYear: year,
    selectedMonth: month,
    today,
    entryTypes: [...ENTRY_TYPES],
    statuses: ["Auto", STATUS_PAID, STATUS_UNPAID],
    monthNames: [...MONTH_NAMES],
    categories: categoryItems.map((category) => category.name),
    categoryItems,
    occurrences: serializeOccurrences(occurrences),
    summary: serializeMoneyMap(summary),
    categoryTotals,
    yearlyTotals,
    user: publicUser(user),
  };
}

async function createEntryEndpoint(db: SupabaseClient, user: AppUser, body: any) {
  const type = String(body.type ?? "");
  if (!(ENTRY_TYPES as readonly string[]).includes(type)) return json({ error: `Tipo invalido: ${type}` }, 400);
  const name = String(body.name ?? "").trim();
  if (!name) return json({ error: "Informe uma descricao." }, 400);

  const amountCents = parseMoneyCents(String(body.amount ?? ""));
  if (amountCents <= 0) return json({ error: "O valor deve ser maior que zero." }, 400);

  const startDateIso = parseUserDate(String(body.date ?? ""));
  const installments = type === ENTRY_INSTALLMENT ? Math.max(1, parseInt(String(body.installments ?? "1"))) : 1;
  if (type === ENTRY_INSTALLMENT && installments <= 1) {
    return json({ error: "Parcelas precisam ter pelo menos 2 vezes." }, 400);
  }
  const statusOverride = !body.status || body.status === "Auto" ? undefined : String(body.status);

  await createEntry(db, user.id, type, name, amountCents, String(body.category ?? ""), startDateIso, installments, statusOverride);
  return json({ ok: true }, 201);
}

async function createCategoryEndpoint(db: SupabaseClient, user: AppUser, body: any) {
  const name = String(body.name ?? "").trim().replace(/\s+/g, " ");
  if (!name) return json({ error: "Informe o nome da categoria." }, 400);

  const existing = await maybeSingle<{ name: string }>(
    db.from("categories").select("name").eq("user_id", user.id).ilike("name", name).limit(1)
  );
  if (existing) return json({ category: existing.name }, 201);

  await checked(db.from("categories").insert({ user_id: user.id, name }));
  return json({ category: name }, 201);
}

async function deleteCategoryEndpoint(db: SupabaseClient, user: AppUser, categoryId: number) {
  if (!categoryId) return json({ error: "ID invalido." }, 400);
  const category = await maybeSingle<{ id: number; name: string }>(
    db.from("categories").select("id,name").eq("id", categoryId).eq("user_id", user.id).limit(1)
  );
  if (!category) return json({ error: "Categoria nao encontrada." }, 404);
  if ((CATEGORIES as readonly string[]).includes(category.name)) {
    return json({ error: "Categorias padrao nao podem ser removidas." }, 400);
  }

  const entryUsage = await maybeSingle<{ id: number }>(
    db.from("entries").select("id").eq("user_id", user.id).eq("category_id", categoryId).limit(1)
  );
  const occurrenceUsage = await maybeSingle<{ id: number }>(
    db.from("occurrences").select("id").eq("user_id", user.id).eq("category_id", categoryId).limit(1)
  );
  if (entryUsage || occurrenceUsage) {
    return json({ error: "Esta categoria ja esta em uso em lancamentos." }, 400);
  }

  await checked(db.from("categories").delete().eq("id", categoryId).eq("user_id", user.id));
  return json({ ok: true });
}

async function toggleOccurrenceEndpoint(db: SupabaseClient, user: AppUser, id: number) {
  if (!id) return json({ error: "ID invalido." }, 400);
  const row = await maybeSingle<{ id: number; status: string }>(
    db.from("occurrences").select("id,status").eq("id", id).eq("user_id", user.id).limit(1)
  );
  if (!row) return json({ error: "Lancamento nao encontrado." }, 404);

  const status = row.status === STATUS_PAID ? STATUS_UNPAID : STATUS_PAID;
  await checked(
    db
      .from("occurrences")
      .update({ status, paid_at: status === STATUS_PAID ? todayIso() : null })
      .eq("id", id)
      .eq("user_id", user.id)
  );
  return json({ status });
}

async function deleteOccurrenceEndpoint(db: SupabaseClient, user: AppUser, body: any) {
  const id = Number(typeof body.occurrence_id === "number" ? body.occurrence_id : body.occurrenceId);
  const scope = String(body.scope ?? "all");
  if (!id) return json({ error: "ID invalido." }, 400);

  const row = await maybeSingle<{ id: number; entry_id: number; due_date: string }>(
    db.from("occurrences").select("id,entry_id,due_date").eq("id", id).eq("user_id", user.id).limit(1)
  );
  if (!row) return json({ error: "Lancamento nao encontrado." }, 404);

  if (scope === "single") {
    await checked(db.from("occurrences").delete().eq("id", id).eq("user_id", user.id));
  } else if (scope === "from") {
    await checked(
      db.from("occurrences").delete().eq("user_id", user.id).eq("entry_id", row.entry_id).gte("due_date", row.due_date)
    );
  } else {
    await checked(db.from("entries").delete().eq("id", row.entry_id).eq("user_id", user.id));
  }
  return json({ ok: true });
}

async function updateInitialInvestedEndpoint(db: SupabaseClient, user: AppUser, body: any) {
  const cents = parseMoneyCents(String(body.amount ?? ""));
  if (cents < 0) return json({ error: "Valor invalido." }, 400);
  await upsertSetting(db, user.id, "initial_invested_cents", String(cents));
  return json({ ok: true, amount: formatCents(cents) });
}

async function updateProfileEndpoint(db: SupabaseClient, user: AppUser, body: any) {
  const displayName = String(body.displayName ?? "").trim().replace(/\s+/g, " ");
  if (displayName.length > 48) return json({ error: "Nome deve ter no maximo 48 caracteres." }, 400);
  const updated = await single<AppUserRow>(
    db
      .from("users")
      .update({ display_name: displayName || null })
      .eq("id", user.id)
      .select(userSelect())
  );
  return json({ user: publicUser(mapUser(updated)) });
}

async function listAdminUsersEndpoint(db: SupabaseClient, user: AppUser) {
  requireAdmin(user);
  const rows = await many<AppUserRow>(db.from("users").select(userSelect()).order("id", { ascending: true }));
  return json({
    users: rows.map((row) => {
      const item = mapUser(row);
      return {
        id: item.id,
        username: item.username,
        email: item.email,
        displayName: item.displayName,
        isAdmin: item.isAdmin,
        disabledAt: item.disabledAt,
        createdAt: row.created_at,
        features: item.features,
        isCurrentUser: item.id === user.id,
      };
    }),
  });
}

async function adminUserActionEndpoint(db: SupabaseClient, user: AppUser, targetId: number, body: any) {
  requireAdmin(user);
  if (!targetId) return json({ error: "ID invalido." }, 400);
  const action = String(body.action ?? "");

  if (action === "disable") {
    if (targetId === user.id) return json({ error: "Voce nao pode desativar sua propria conta." }, 400);
    await checked(db.from("users").update({ disabled_at: new Date().toISOString() }).eq("id", targetId));
    return json({ ok: true });
  }
  if (action === "enable") {
    await checked(db.from("users").update({ disabled_at: null }).eq("id", targetId));
    return json({ ok: true });
  }
  if (action === "feature") {
    const key = String(body.key ?? "").trim();
    const enabled = Boolean(body.enabled);
    if (!/^[a-z0-9_.-]{1,48}$/.test(key)) return json({ error: "Feature invalida." }, 400);
    const target = await maybeSingle<{ feature_flags: string }>(
      db.from("users").select("feature_flags").eq("id", targetId).limit(1)
    );
    if (!target) return json({ error: "Usuario nao encontrado." }, 404);
    const nextFeatures = { ...parseFeatureFlags(target.feature_flags), [key]: enabled };
    await checked(db.from("users").update({ feature_flags: JSON.stringify(nextFeatures) }).eq("id", targetId));
    return json({ ok: true, features: nextFeatures });
  }
  return json({ error: "Acao invalida." }, 400);
}

async function seedDefaultUserIfNeeded(db: SupabaseClient) {
  const existing = await maybeSingle<{ id: number }>(
    db.from("users").select("id").eq("username", DEFAULT_USERNAME).limit(1)
  );
  let userId = existing?.id;
  if (!userId) {
    const created = await single<{ id: number }>(
      db
        .from("users")
        .insert({
          username: DEFAULT_USERNAME,
          password_hash: "legacy-seed",
          is_admin: false,
        })
        .select("id")
    );
    userId = created.id;
  }

  const seedLock = await maybeSingle<{ value: string }>(
    db.from("settings").select("value").eq("user_id", userId).eq("key", "seeded_initial_data").limit(1)
  );
  if (seedLock) return;

  await initializeDefaultsForUser(db, userId, INITIAL_INVESTED_CENTS);
  if (!(await userHasEntries(db, userId))) {
    await seedInitialEntriesForUser(db, userId);
  }
  await upsertSetting(db, userId, "seeded_initial_data", "1");
}

async function initializeDefaultsForUser(db: SupabaseClient, userId: number, initialInvestedCents = 0) {
  await checked(
    db
      .from("categories")
      .upsert(
        CATEGORIES.map((name) => ({ user_id: userId, name })),
        { onConflict: "user_id,name", ignoreDuplicates: true }
      )
  );
  await checked(
    db
      .from("settings")
      .upsert(
        [
          { user_id: userId, key: "active_year", value: String(ACTIVE_YEAR) },
          { user_id: userId, key: "initial_invested_cents", value: String(initialInvestedCents) },
        ],
        { onConflict: "user_id,key", ignoreDuplicates: true }
      )
  );
}

async function seedInitialEntriesForUser(db: SupabaseClient, userId: number) {
  const categoryMap = await getCategoryIdMap(db, userId);
  const entryRows = INITIAL_ENTRIES.map((entry, index) => {
    const categoryId = categoryMap.get(entry.category);
    if (!categoryId) throw statusError(`Categoria invalida: ${entry.category}`, 400);
    return {
      user_id: userId,
      type: entry.type,
      name: entry.name,
      total_amount_cents: entry.amountCents,
      category_id: categoryId,
      start_date: entry.startDate,
      installments: entry.installments,
      notes: `seed:${index}`,
    };
  });

  const createdEntries = await checked<
    {
      id: number;
      type: string;
      name: string;
      total_amount_cents: number;
      category_id: number;
      start_date: string;
      installments: number;
    }[]
  >(
    db
      .from("entries")
      .insert(entryRows)
      .select("id,type,name,total_amount_cents,category_id,start_date,installments")
  );

  const occurrenceRows = createdEntries.flatMap((entry) =>
    buildOccurrences(
      userId,
      entry.id,
      entry.category_id,
      entry.type,
      entry.name,
      entry.total_amount_cents,
      entry.start_date,
      entry.installments
    )
  );

  if (occurrenceRows.length > 0) {
    await checked(db.from("occurrences").insert(occurrenceRows));
  }
}

async function ensureSetting(db: SupabaseClient, userId: number, key: string, value: string) {
  const row = await maybeSingle<{ value: string }>(
    db.from("settings").select("value").eq("user_id", userId).eq("key", key).limit(1)
  );
  if (!row) await upsertSetting(db, userId, key, value);
}

async function upsertSetting(db: SupabaseClient, userId: number, key: string, value: string) {
  await checked(
    db.from("settings").upsert({ user_id: userId, key, value }, { onConflict: "user_id,key" })
  );
}

async function getInitialInvestedCents(db: SupabaseClient, userId: number) {
  const row = await maybeSingle<{ value: string }>(
    db.from("settings").select("value").eq("user_id", userId).eq("key", "initial_invested_cents").limit(1)
  );
  return row ? parseInt(row.value) : 0;
}

async function getCategoryItems(db: SupabaseClient, userId: number) {
  const rows = await many<{ id: number; name: string }>(
    db.from("categories").select("id,name").eq("user_id", userId).order("id", { ascending: true })
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    isDefault: (CATEGORIES as readonly string[]).includes(row.name),
  }));
}

async function getCategoryId(db: SupabaseClient, userId: number, name: string) {
  const row = await maybeSingle<{ id: number }>(
    db.from("categories").select("id").eq("user_id", userId).eq("name", name).limit(1)
  );
  return row?.id ?? null;
}

async function getCategoryIdMap(db: SupabaseClient, userId: number) {
  const rows = await many<{ id: number; name: string }>(
    db.from("categories").select("id,name").eq("user_id", userId)
  );
  return new Map(rows.map((row) => [row.name, row.id]));
}

async function userHasEntries(db: SupabaseClient, userId: number) {
  const row = await maybeSingle<{ id: number }>(
    db.from("entries").select("id").eq("user_id", userId).limit(1)
  );
  return Boolean(row);
}

async function createEntry(
  db: SupabaseClient,
  userId: number,
  entryType: string,
  name: string,
  amountCents: number,
  category: string,
  startDateIso: string,
  installments: number,
  statusOverride?: string
) {
  const categoryId = await getCategoryId(db, userId, category);
  if (!categoryId) throw statusError(`Categoria invalida: ${category}`, 400);

  const entry = await single<{ id: number }>(
    db
      .from("entries")
      .insert({
        user_id: userId,
        type: entryType,
        name: name.trim(),
        total_amount_cents: amountCents,
        category_id: categoryId,
        start_date: startDateIso,
        installments,
        notes: "",
      })
      .select("id")
  );

  const occurrenceRows = buildOccurrences(userId, entry.id, categoryId, entryType, name.trim(), amountCents, startDateIso, installments, statusOverride);
  if (occurrenceRows.length > 0) await checked(db.from("occurrences").insert(occurrenceRows));
}

function buildOccurrences(
  userId: number,
  entryId: number,
  categoryId: number,
  entryType: string,
  name: string,
  amountCents: number,
  startDateIso: string,
  installments: number,
  statusOverride?: string
) {
  const [startYear, startMonth, startDay] = startDateIso.split("-").map(Number);
  const today = todayIso();
  const rows: Record<string, unknown>[] = [];

  const pushOccurrence = (dueDate: string, amount: number, installmentNumber: number | null, installmentTotal: number | null) => {
    const status = statusOverride ?? defaultStatusForDate(dueDate);
    rows.push({
      user_id: userId,
      entry_id: entryId,
      category_id: categoryId,
      type: entryType,
      name,
      due_date: dueDate,
      year: parseInt(dueDate.slice(0, 4)),
      month: parseInt(dueDate.slice(5, 7)),
      amount_cents: amount,
      installment_number: installmentNumber,
      installment_total: installmentTotal,
      status,
      paid_at: status === STATUS_PAID ? today : null,
    });
  };

  if (entryType === ENTRY_FIXED) {
    if (startYear > ACTIVE_YEAR) return rows;
    const fromMonth = startYear === ACTIVE_YEAR ? startMonth : 1;
    for (let month = fromMonth; month <= 12; month++) {
      const d = Math.min(startDay, lastDayOfMonth(ACTIVE_YEAR, month));
      pushOccurrence(`${ACTIVE_YEAR}-${pad2(month)}-${pad2(d)}`, amountCents, null, null);
    }
    return rows;
  }

  if (entryType === ENTRY_INSTALLMENT) {
    const amounts = splitAmount(amountCents, installments);
    for (let i = 0; i < installments; i++) {
      pushOccurrence(addMonths(startDateIso, i), amounts[i], i + 1, installments);
    }
    return rows;
  }

  pushOccurrence(startDateIso, amountCents, null, null);
  return rows;
}

async function listOccurrences(db: SupabaseClient, userId: number, year: number, month: number) {
  const rows = await many<any>(
    db
      .from("occurrences")
      .select("id,entry_id,type,name,due_date,amount_cents,installment_number,installment_total,status,categories!inner(name)")
      .eq("user_id", userId)
      .eq("year", year)
      .eq("month", month)
      .order("due_date", { ascending: true })
      .order("id", { ascending: true })
  );
  return rows.map(mapOccurrenceRow);
}

async function listYearOccurrences(db: SupabaseClient, userId: number, year: number) {
  const rows = await many<any>(
    db
      .from("occurrences")
      .select("id,entry_id,type,name,due_date,year,month,amount_cents,installment_number,installment_total,status,categories!inner(name)")
      .eq("user_id", userId)
      .eq("year", year)
      .order("month", { ascending: true })
  );
  return rows.map(mapOccurrenceRow);
}

function mapOccurrenceRow(row: any): OccurrenceRow & { year?: number; month?: number } {
  return {
    id: row.id,
    entryId: row.entry_id,
    type: row.type,
    name: row.name,
    category: row.categories?.name ?? "",
    dueDate: row.due_date,
    amountCents: row.amount_cents,
    installmentNumber: row.installment_number,
    installmentTotal: row.installment_total,
    status: row.status,
    year: row.year,
    month: row.month,
  };
}

function computeMonthlySummaryFromRows(year: number, rows: OccurrenceRow[], initialInvested: number, investedYear: number) {
  const income = sumRows(rows, (row) => row.type === ENTRY_INCOME && row.status === STATUS_PAID);
  const receivableIncome = sumRows(rows, (row) => row.type === ENTRY_INCOME && row.status === STATUS_UNPAID);
  const expenses = sumRows(rows, (row) => row.type !== ENTRY_INCOME);
  const paidExpenses = sumRows(rows, (row) => row.type !== ENTRY_INCOME && row.status === STATUS_PAID);
  const openExpenses = sumRows(rows, (row) => row.type !== ENTRY_INCOME && row.status === STATUS_UNPAID);
  const investedMonth = sumRows(rows, (row) => row.type !== ENTRY_INCOME && row.category === "Investimento");

  return {
    initial_invested: year === ACTIVE_YEAR ? initialInvested : 0,
    income,
    receivable_income: receivableIncome,
    expenses,
    paid_expenses: paidExpenses,
    open_expenses: openExpenses,
    invested_month: investedMonth,
    balance: income - expenses,
    invested_year: investedYear,
  };
}

function computeMonthlyCategories(rows: OccurrenceRow[]) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (row.type === ENTRY_INCOME) continue;
    totals.set(row.category, (totals.get(row.category) ?? 0) + row.amountCents);
  }
  return [...totals.entries()]
    .filter(([, total]) => total > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([category, totalCents]) => ({ category, totalCents, total: formatCents(totalCents) }));
}

function computeYearInvested(rows: OccurrenceRow[], year: number, initialInvested: number) {
  const invested = sumRows(rows, (row) => row.type !== ENTRY_INCOME && row.category === "Investimento" && row.status === STATUS_PAID);
  return (year === ACTIVE_YEAR ? initialInvested : 0) + invested;
}

function computeYearlyTotals(rows: (OccurrenceRow & { month?: number })[]) {
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const monthRows = rows.filter((row) => row.month === month);
    const income = sumRows(monthRows, (row) => row.type === ENTRY_INCOME && row.status === STATUS_PAID);
    const expenses = sumRows(monthRows, (row) => row.type !== ENTRY_INCOME);
    const invested = sumRows(monthRows, (row) => row.type !== ENTRY_INCOME && row.category === "Investimento");
    return {
      month,
      monthName: MONTH_NAMES[index],
      incomeCents: income,
      expensesCents: expenses,
      investedCents: invested,
      balanceCents: income - expenses,
    };
  });
}

function serializeOccurrences(rows: OccurrenceRow[]) {
  return rows.map((row) => ({
    id: row.id,
    entryId: row.entryId,
    type: row.type,
    name: row.name,
    category: row.category,
    dueDate: row.dueDate,
    dateLabel: formatDateLabel(row.dueDate),
    amountCents: row.amountCents,
    amount: formatCents(row.amountCents),
    installment: row.installmentNumber && row.installmentTotal ? `${row.installmentNumber}/${row.installmentTotal}` : "",
    status: row.status,
  }));
}

function sumRows(rows: OccurrenceRow[], predicate: (row: OccurrenceRow) => boolean) {
  return rows.filter(predicate).reduce((sum, row) => sum + row.amountCents, 0);
}

async function nextAvailableUsername(db: SupabaseClient, base: string) {
  const cleanBase = base || "usuario";
  for (let attempt = 0; attempt < 100; attempt++) {
    const username = attempt === 0 ? cleanBase : `${cleanBase}-${attempt + 1}`;
    const existing = await maybeSingle<{ id: number }>(
      db.from("users").select("id").eq("username", username).limit(1)
    );
    if (!existing) return username;
  }
  return `usuario-${Date.now()}`;
}

function usernameFromSupabase(authUser: SupabaseAuthUser) {
  const metadataUsername = String(authUser.user_metadata?.username ?? "").trim().toLowerCase();
  if (/^[a-z0-9_.-]{3,32}$/.test(metadataUsername)) return metadataUsername;
  const emailLocal = authUser.email?.split("@")[0] ?? "";
  const sanitized = emailLocal.toLowerCase().replace(/[^a-z0-9_.-]/g, "-").replace(/-+/g, "-");
  if (sanitized.length >= 3) return sanitized.slice(0, 32);
  return `usuario-${authUser.id.slice(0, 8)}`;
}

function publicUser(user: AppUser) {
  return {
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    isAdmin: user.isAdmin,
    features: user.features,
  };
}

type AppUserRow = {
  id: number;
  username: string;
  email: string | null;
  display_name: string | null;
  is_admin: boolean;
  disabled_at: string | null;
  feature_flags: string | null;
  created_at: string | null;
};

function userSelect() {
  return "id,username,email,display_name,is_admin,disabled_at,feature_flags,created_at";
}

function mapUser(row: AppUserRow): AppUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.display_name,
    isAdmin: row.is_admin,
    disabledAt: row.disabled_at,
    features: parseFeatureFlags(row.feature_flags),
  };
}

function parseFeatureFlags(value: string | null | undefined) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).map(([key, enabled]) => [key, Boolean(enabled)]));
  } catch {
    return {};
  }
}

function requireAdmin(user: AppUser) {
  if (!user.isAdmin) throw statusError("Acesso de admin necessario.", 403);
}

function getAdminEmail(env: Env) {
  return (env.ADMIN_EMAIL || "gamoxkun@gmail.com").trim().toLowerCase();
}

function normalizeDisplayName(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 48);
}

function parseMoneyCents(value: string) {
  const normalized = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return Math.round((parseFloat(normalized) || 0) * 100);
}

function parseUserDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) throw statusError("Data invalida. Use DD/MM/AAAA.", 400);
  const [, day, month, year] = match;
  return `${year}-${pad2(Number(month))}-${pad2(Number(day))}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function defaultStatusForDate(dateIso: string) {
  return dateIso <= PAID_CUTOFF_ISO ? STATUS_PAID : STATUS_UNPAID;
}

function addMonths(dateIso: string, offset: number) {
  const [year, month, day] = dateIso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  const nextYear = date.getUTCFullYear();
  const nextMonth = date.getUTCMonth() + 1;
  const nextDay = Math.min(day, lastDayOfMonth(nextYear, nextMonth));
  return `${nextYear}-${pad2(nextMonth)}-${pad2(nextDay)}`;
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatDateLabel(dateIso: string) {
  const [year, month, day] = dateIso.split("-");
  return `${day}/${month}/${year}`;
}

function splitAmount(total: number, parts: number) {
  const base = Math.floor(total / parts);
  let remainder = total % parts;
  return Array.from({ length: parts }, () => {
    const amount = base + (remainder > 0 ? 1 : 0);
    remainder -= remainder > 0 ? 1 : 0;
    return amount;
  });
}

function formatCents(cents: number) {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const value = (absolute / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}R$ ${value}`;
}

function serializeMoneyMap(values: Record<string, number>) {
  return Object.fromEntries(
    Object.entries(values).map(([key, cents]) => [key, { cents, label: formatCents(cents) }])
  );
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

type SupabaseOperation = "select" | "insert" | "update" | "upsert" | "delete";

class SupabaseRestClient {
  private readonly baseUrl: string;
  private readonly key: string;

  constructor(baseUrl: string, key: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.key = key;
  }

  from(table: string) {
    return new SupabaseRestQuery(this.baseUrl, this.key, table);
  }
}

class SupabaseRestQuery {
  private operation: SupabaseOperation | null = null;
  private body: unknown = undefined;
  private selectColumns: string | null = null;
  private readonly filters: string[] = [];
  private readonly orderParts: string[] = [];
  private limitValue: number | null = null;
  private onConflict: string | null = null;
  private ignoreDuplicates = false;

  constructor(
    private readonly baseUrl: string,
    private readonly key: string,
    private readonly table: string
  ) {}

  select(columns: string) {
    if (!this.operation) this.operation = "select";
    this.selectColumns = columns;
    return this;
  }

  insert(body: unknown) {
    this.operation = "insert";
    this.body = body;
    return this;
  }

  update(body: unknown) {
    this.operation = "update";
    this.body = body;
    return this;
  }

  upsert(body: unknown, options: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
    this.operation = "upsert";
    this.body = body;
    this.onConflict = options.onConflict ?? null;
    this.ignoreDuplicates = Boolean(options.ignoreDuplicates);
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    return this.filter(column, "eq", value);
  }

  gte(column: string, value: unknown) {
    return this.filter(column, "gte", value);
  }

  ilike(column: string, value: unknown) {
    return this.filter(column, "ilike", value);
  }

  is(column: string, value: unknown) {
    return this.filter(column, "is", value === null ? "null" : value);
  }

  limit(value: number) {
    this.limitValue = value;
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.orderParts.push(`${column}.${options.ascending === false ? "desc" : "asc"}`);
    return this;
  }

  async maybeSingle() {
    const result = await this.execute();
    if (result.error) return result;
    if (Array.isArray(result.data)) return { data: result.data[0] ?? null, error: null };
    return result;
  }

  async single() {
    const result = await this.execute();
    if (result.error) return result;
    if (Array.isArray(result.data)) {
      const data = result.data[0] ?? null;
      return { data, error: data ? null : statusError("Registro nao encontrado.", 404) };
    }
    return result;
  }

  then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private filter(column: string, operator: string, value: unknown) {
    this.filters.push(`${encodeURIComponent(column)}=${operator}.${encodeFilterValue(value)}`);
    return this;
  }

  private async execute() {
    const operation = this.operation ?? "select";
    const search = new URLSearchParams();
    if (this.selectColumns) search.set("select", this.selectColumns);
    if (this.limitValue !== null) search.set("limit", String(this.limitValue));
    if (this.orderParts.length > 0) search.set("order", this.orderParts.join(","));
    if (this.onConflict) search.set("on_conflict", this.onConflict);

    const filterQuery = this.filters.length > 0 ? `&${this.filters.join("&")}` : "";
    const query = search.toString();
    const url = `${this.baseUrl}/rest/v1/${encodeURIComponent(this.table)}${query || filterQuery ? "?" : ""}${query}${filterQuery}`;

    const headers = new Headers({
      apikey: this.key,
      Authorization: `Bearer ${this.key}`,
      "Content-Type": "application/json",
    });

    if ((operation === "insert" || operation === "update" || operation === "upsert") && this.selectColumns) {
      headers.set("Prefer", "return=representation");
    }
    if (operation === "upsert") {
      const resolution = this.ignoreDuplicates ? "resolution=ignore-duplicates" : "resolution=merge-duplicates";
      const current = headers.get("Prefer");
      headers.set("Prefer", current ? `${current},${resolution}` : resolution);
    }

    const init: RequestInit = { headers, method: methodForOperation(operation) };
    if (operation === "insert" || operation === "update" || operation === "upsert") {
      init.body = JSON.stringify(this.body);
    }

    const response = await fetch(url, init);
    const text = await response.text();
    const data = text ? parseJson(text) : null;

    if (!response.ok) {
      const message = data?.message || data?.error_description || data?.error || response.statusText;
      return { data: null, error: statusError(message, response.status) };
    }
    return { data, error: null };
  }
}

function methodForOperation(operation: SupabaseOperation) {
  if (operation === "select") return "GET";
  if (operation === "update") return "PATCH";
  if (operation === "delete") return "DELETE";
  return "POST";
}

function encodeFilterValue(value: unknown) {
  return encodeURIComponent(String(value));
}

function parseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function checked<T = unknown>(query: any) {
  const { data, error } = await query;
  if (error) throw error;
  return data as T;
}

async function many<T>(query: any) {
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as T[];
}

async function maybeSingle<T>(query: any) {
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data as T | null;
}

async function single<T>(query: any) {
  const { data, error } = await query.single();
  if (error) throw error;
  if (!data) throw new Error("Registro nao encontrado.");
  return data as T;
}

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function forbiddenLegacyAuth() {
  return json({ error: "Use o login do Supabase." }, 410);
}

function assertEnv(env: Env, key: keyof Env) {
  if (!env[key]) throw statusError(`Variavel ${key} nao configurada.`, 500);
}

function statusError(message: string, status: number) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function inferStatus(error: unknown) {
  if (typeof error === "object" && error && "status" in error && typeof (error as any).status === "number") {
    return (error as any).status;
  }
  return 500;
}

function normalizeError(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}
