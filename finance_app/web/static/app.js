const state = {
  month: new Date().getMonth() + 1,
  year: 2026,
  data: null,
  view: "dashboard",
  session: null,
  passwordRecovery: false,
  adminUsers: [],
};

const els = {};
const SUPABASE_URL = "https://yrarkwxaivsqsnpgabmh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_RYJDWtHHQKmb9bIrrw9IIA_wY3u8GiD";
let supabaseClient = null;

document.addEventListener("DOMContentLoaded", () => {
  supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) ?? null;
  bindElements();
  bindEvents();
  bootSession();
});

function bindElements() {
  const ids = [
    "page-title",
    "auth-shell",
    "app-shell",
    "login-tab",
    "register-tab",
    "login-form",
    "register-form",
    "login-username",
    "login-password",
    "forgot-password-button",
    "google-login-button",
    "register-email",
    "register-username",
    "register-password",
    "reset-form",
    "reset-password",
    "reset-confirm",
    "reset-cancel-button",
    "auth-separator",
    "current-user",
    "logout-button",
    "admin-nav-item",
    "month-filter",
    "year-filter",
    "refresh-button",
    "summary-grid",
    "dashboard-rows",
    "occurrence-rows",
    "entry-form",
    "entry-type",
    "entry-name",
    "entry-amount",
    "entry-category",
    "entry-date",
    "entry-installments",
    "entry-status",
    "installments-field",
    "new-category-button",
    "profile-form",
    "profile-username",
    "profile-display-name",
    "password-form",
    "password-current",
    "password-new",
    "password-confirm",
    "profile-category-list",
    "admin-refresh-button",
    "admin-user-rows",
    "edit-invested-button",
    "category-chart",
    "year-chart",
    "category-large-chart",
    "year-large-chart",
    "toast",
    "action-dialog",
    "action-title",
    "action-copy",
    "action-options",
    "text-dialog",
    "text-dialog-form",
    "text-dialog-title",
    "text-dialog-label",
    "text-dialog-input",
    "text-cancel-button",
  ];
  ids.forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function bindEvents() {
  els["login-tab"].addEventListener("click", () => switchAuthMode("login"));
  els["register-tab"].addEventListener("click", () => switchAuthMode("register"));
  els["login-form"].addEventListener("submit", submitLogin);
  els["register-form"].addEventListener("submit", submitRegister);
  els["reset-form"].addEventListener("submit", submitPasswordRecovery);
  els["reset-cancel-button"].addEventListener("click", () => {
    state.passwordRecovery = false;
    clearAuthUrl();
    switchAuthMode("login");
    renderAuthState();
  });
  els["forgot-password-button"].addEventListener("click", resetPassword);
  els["google-login-button"].addEventListener("click", loginWithGoogle);
  els["logout-button"].addEventListener("click", logout);
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });
  document.querySelectorAll("[data-view-jump]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.viewJump));
  });
  els["refresh-button"].addEventListener("click", loadState);
  els["month-filter"].addEventListener("change", () => {
    state.month = Number(els["month-filter"].value);
    loadState();
  });
  els["year-filter"].addEventListener("change", () => {
    state.year = Number(els["year-filter"].value);
    loadState();
  });
  els["entry-type"].addEventListener("change", syncEntryTypeFields);
  els["entry-form"].addEventListener("submit", submitEntry);
  els["new-category-button"].addEventListener("click", createCategory);
  document.querySelectorAll("[data-create-category]").forEach((button) => {
    button.addEventListener("click", createCategory);
  });
  els["profile-form"].addEventListener("submit", submitProfile);
  els["password-form"].addEventListener("submit", submitPassword);
  els["admin-refresh-button"].addEventListener("click", loadAdminUsers);
  els["edit-invested-button"].addEventListener("click", editInitialInvested);
  els["text-cancel-button"].addEventListener("click", () => els["text-dialog"].close());
  window.addEventListener("resize", debounce(drawCharts, 120));

  supabaseClient?.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" && session) {
      saveSupabaseSession(session, session.user);
      showPasswordRecovery();
    }
  });
}

async function loadState() {
  if (!state.session) {
    renderAuthState();
    return;
  }

  try {
    const response = await fetch(`/api/state?year=${state.year}&month=${state.month}`, {
      headers: authHeaders(),
    });
    const data = await readJson(response);
    state.data = data;
    if (data.user) {
      updateSessionUser(data.user);
    }
    state.year = data.selectedYear;
    state.month = data.selectedMonth;
    render();
  } catch (error) {
    showToast(error.message || "Nao foi possivel carregar os dados.");
  }
}

async function submitLogin(event) {
  event.preventDefault();
  try {
    const client = requireSupabase();
    const { data, error } = await client.auth.signInWithPassword({
      email: els["login-username"].value.trim(),
      password: els["login-password"].value,
    });
    if (error) throw error;
    saveSupabaseSession(data.session, data.user);
    renderAuthState();
    showToast("Sessao iniciada.");
    await loadState();
  } catch (error) {
    showToast(error.message || "Nao foi possivel entrar.");
  }
}

async function submitRegister(event) {
  event.preventDefault();
  try {
    const client = requireSupabase();
    const username = els["register-username"].value.trim();
    const { data, error } = await client.auth.signUp({
      email: els["register-email"].value.trim(),
      password: els["register-password"].value,
      options: {
        data: username ? { username } : {},
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
    if (!data.session) {
      showToast("Conta criada. Confira seu email para confirmar o acesso.");
      return;
    }
    saveSupabaseSession(data.session, data.user);
    renderAuthState();
    showToast("Conta criada.");
    await loadState();
  } catch (error) {
    showToast(error.message || "Nao foi possivel criar a conta.");
  }
}

async function loginWithGoogle() {
  try {
    const client = requireSupabase();
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  } catch (error) {
    showToast(error.message || "Nao foi possivel iniciar o Google Login.");
  }
}

async function resetPassword() {
  const email = els["login-username"].value.trim();
  if (!email) {
    showToast("Informe seu email primeiro.");
    return;
  }

  try {
    const client = requireSupabase();
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}?password_recovery=1`,
    });
    if (error) throw error;
    showToast("Enviamos o link de redefinicao para seu email.");
  } catch (error) {
    showToast(error.message || "Nao foi possivel enviar o email.");
  }
}

async function submitPasswordRecovery(event) {
  event.preventDefault();
  const password = els["reset-password"].value;
  const confirmation = els["reset-confirm"].value;

  if (password !== confirmation) {
    showToast("As senhas nao conferem.");
    return;
  }

  try {
    const client = requireSupabase();
    const { error } = await client.auth.updateUser({ password });
    if (error) throw error;

    const { data } = await client.auth.getSession();
    if (data.session) {
      saveSupabaseSession(data.session, data.session.user);
    }

    els["reset-form"].reset();
    state.passwordRecovery = false;
    clearAuthUrl();
    renderAuthState();
    showToast("Senha redefinida.");
    await loadState();
  } catch (error) {
    showToast(error.message || "Nao foi possivel redefinir a senha.");
  }
}

async function bootSession() {
  const isRecovery = isPasswordRecoveryUrl();
  await restoreSupabaseSession();
  if (isRecovery && state.session) {
    showPasswordRecovery();
    return;
  }
  if (!state.session) {
    restoreSession();
  }
  renderAuthState();
  if (state.session) {
    if (!isRecovery && new URLSearchParams(window.location.search).has("code")) {
      clearAuthUrl();
    }
    await loadState();
  }
}

async function restoreSupabaseSession() {
  if (!supabaseClient) return;
  const code = new URLSearchParams(window.location.search).get("code");
  if (code) {
    await supabaseClient.auth.exchangeCodeForSession(code);
  }
  const { data, error } = await supabaseClient.auth.getSession();
  if (error || !data.session) return;
  saveSupabaseSession(data.session, data.session.user);
}

function isPasswordRecoveryUrl() {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return (
    search.get("password_recovery") === "1" ||
    search.get("type") === "recovery" ||
    hash.get("type") === "recovery"
  );
}

function showPasswordRecovery() {
  state.passwordRecovery = true;
  renderAuthState();
  switchAuthMode("reset");
}

function clearAuthUrl() {
  if (window.location.search || window.location.hash) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

function restoreSession() {
  try {
    const raw = localStorage.getItem("financeiro-session");
    state.session = raw ? JSON.parse(raw) : null;
  } catch {
    state.session = null;
  }
}

function saveSession(session) {
  state.session = session;
  localStorage.setItem("financeiro-session", JSON.stringify(session));
}

function saveSupabaseSession(session, user) {
  if (!session?.access_token || !user) return;
  saveSession({
    provider: "supabase",
    token: session.access_token,
    authEmail: user.email,
    user: {
      username: user.user_metadata?.username || user.email || "Usuario",
      displayName: user.user_metadata?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || null,
    },
  });
}

function updateSessionUser(user) {
  if (!state.session) return;
  state.session = {
    ...state.session,
    user,
  };
  localStorage.setItem("financeiro-session", JSON.stringify(state.session));
  renderAuthState();
}

async function logout() {
  if (supabaseClient) {
    await supabaseClient.auth.signOut();
  }
  state.session = null;
  state.data = null;
  localStorage.removeItem("financeiro-session");
  renderAuthState();
}

function renderAuthState() {
  const isLoggedIn = Boolean(state.session?.token);
  els["auth-shell"].classList.toggle("hidden", isLoggedIn && !state.passwordRecovery);
  els["app-shell"].classList.toggle("hidden", !isLoggedIn || state.passwordRecovery);
  if (isLoggedIn) {
    const user = state.session.user ?? {};
    els["current-user"].textContent = user.displayName || user.username || "Usuario";
    els["admin-nav-item"].classList.toggle("hidden", !user.isAdmin);
    if (!user.isAdmin && state.view === "admin") {
      switchView("dashboard");
    }
  } else {
    els["admin-nav-item"].classList.add("hidden");
  }
}

function switchAuthMode(mode) {
  const isLogin = mode === "login";
  const isReset = mode === "reset";
  els["login-tab"].classList.toggle("active", isLogin);
  els["register-tab"].classList.toggle("active", mode === "register");
  els["login-form"].classList.toggle("active", isLogin);
  els["register-form"].classList.toggle("active", mode === "register");
  els["reset-form"].classList.toggle("active", isReset);
  els["auth-separator"].classList.toggle("hidden", isReset);
  els["google-login-button"].classList.toggle("hidden", isReset);
}

function render() {
  fillFilters();
  fillFormOptions();
  renderSummary();
  renderTables();
  renderProfile();
  renderAdminUsers();
  drawCharts();
}

function fillFilters() {
  const data = state.data;
  els["page-title"].textContent = `${data.monthNames[state.month - 1]} ${state.year}`;
  els["month-filter"].innerHTML = data.monthNames
    .map((name, index) => `<option value="${index + 1}">${name}</option>`)
    .join("");
  els["month-filter"].value = String(state.month);
  els["year-filter"].value = String(state.year);
}

function fillFormOptions() {
  const data = state.data;
  fillSelect(els["entry-type"], data.entryTypes, els["entry-type"].value || "Variavel");
  fillSelect(els["entry-category"], data.categories, els["entry-category"].value || "Outros");
  syncStatusOptions();
  if (!els["entry-date"].value) {
    els["entry-date"].value = data.today;
  }
  syncEntryTypeFields();
}

function fillSelect(select, values, preferred = "") {
  const current = preferred || select.value;
  select.innerHTML = values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
  if (values.includes(current)) {
    select.value = current;
  }
}

function syncInstallmentsVisibility() {
  const isInstallment = els["entry-type"].value === "Parcela";
  els["installments-field"].style.display = isInstallment ? "grid" : "none";
}

function syncStatusOptions() {
  const current = els["entry-status"].value || "Auto";
  const isIncome = els["entry-type"].value === "Recebido";
  const values = [
    { value: "Auto", label: "Auto" },
    { value: "Pago", label: isIncome ? "Recebido" : "Pago" },
    { value: "Nao pago", label: isIncome ? "Nao recebido" : "Nao pago" },
  ];
  els["entry-status"].innerHTML = values
    .map((item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`)
    .join("");
  els["entry-status"].value = values.some((item) => item.value === current) ? current : "Auto";
}

function syncEntryTypeFields() {
  syncInstallmentsVisibility();
  syncStatusOptions();
}

function renderSummary() {
  const summary = state.data.summary;
  const metrics = [
    ["Recebido", summary.income.label, "good"],
    ["A receber", summary.receivable_income.label, summary.receivable_income.cents > 0 ? "warn" : ""],
    ["Despesas", summary.expenses.label, summary.expenses.cents > 0 ? "bad" : ""],
    ["Em aberto", summary.open_expenses.label, summary.open_expenses.cents > 0 ? "warn" : ""],
    ["Sobra", summary.balance.label, summary.balance.cents >= 0 ? "good" : "bad"],
    ["Investido no mes", summary.invested_month.label, "good"],
    ["Investido inicial", summary.initial_invested.label, ""],
    ["Investido no ano", summary.invested_year.label, "good"],
    ["Pagas", summary.paid_expenses.label, ""],
  ];
  els["summary-grid"].innerHTML = metrics
    .map(([label, value, tone]) => `<article class="metric" data-tone="${tone}"><span>${label}</span><strong>${value}</strong></article>`)
    .join("");
}

function renderTables() {
  const rows = state.data.occurrences;
  els["dashboard-rows"].innerHTML = rows.slice(0, 8).map(renderDashboardRow).join("") || emptyRow(5);
  els["occurrence-rows"].innerHTML = rows.map(renderOccurrenceRow).join("") || emptyRow(8);
}

function renderDashboardRow(item) {
  return `
    <tr>
      <td>${item.dateLabel}</td>
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.category)}</td>
      <td class="amount">${item.amount}</td>
      <td>${statusPill(item.status, item.type)}</td>
    </tr>
  `;
}

function renderOccurrenceRow(item) {
  return `
    <tr>
      <td>${item.dateLabel}</td>
      <td>${item.type}</td>
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.category)}</td>
      <td>${item.installment || "-"}</td>
      <td class="amount">${item.amount}</td>
      <td>${statusPill(item.status, item.type)}</td>
      <td>
        <div class="row-actions">
          <button class="button compact ghost" type="button" onclick="toggleOccurrence(${item.id})">Status</button>
          <button class="button compact" type="button" onclick="openDeleteDialogById(${item.id})">Remover</button>
        </div>
      </td>
    </tr>
  `;
}

function emptyRow(columns) {
  return `<tr><td colspan="${columns}">Nenhum lancamento para este periodo.</td></tr>`;
}

function statusPill(status, type) {
  const cls = status === "Pago" ? "paid" : "open";
  return `<span class="pill ${cls}">${displayStatus(status, type)}</span>`;
}

function displayStatus(status, type) {
  if (type === "Recebido") {
    return status === "Pago" ? "Recebido" : "Nao recebido";
  }
  return status;
}

async function submitEntry(event) {
  event.preventDefault();
  const payload = {
    type: els["entry-type"].value,
    name: els["entry-name"].value,
    amount: els["entry-amount"].value,
    category: els["entry-category"].value,
    date: dateInputToUserDate(els["entry-date"].value),
    installments: Number(els["entry-installments"].value || 1),
    status: els["entry-status"].value,
  };

  try {
    await readJson(await fetch("/api/entries", postOptions(payload)));
    els["entry-form"].reset();
    setFormDefaults();
    showToast("Lancamento criado.");
    await loadState();
  } catch (error) {
    showToast(error.message || "Nao foi possivel lancar.");
  }
}

function setFormDefaults() {
  els["entry-type"].value = "Variavel";
  els["entry-category"].value = "Outros";
  els["entry-status"].value = "Auto";
  els["entry-date"].value = state.data.today;
  els["entry-installments"].value = "2";
  syncEntryTypeFields();
}

async function toggleOccurrence(id) {
  try {
    await readJson(await fetch(`/api/occurrences/${id}/toggle`, postOptions({})));
    await loadState();
  } catch (error) {
    showToast(error.message || "Nao foi possivel atualizar.");
  }
}

function openDeleteDialogById(id) {
  const item = state.data.occurrences.find((occurrence) => occurrence.id === id);
  if (!item) {
    showToast("Lancamento nao encontrado.");
    return;
  }

  const options = deleteOptionsFor(item);
  els["action-title"].textContent = `Remover ${item.name}`;
  els["action-copy"].textContent = options.copy;
  els["action-options"].innerHTML = options.actions
    .map((action) => `<button class="button ${action.primary ? "primary" : "ghost"}" type="button" data-scope="${action.scope}">${action.label}</button>`)
    .join("") + `<button class="button ghost" type="button" data-cancel="true">Cancelar</button>`;
  els["action-options"].querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", async () => {
      if (button.dataset.cancel) {
        els["action-dialog"].close();
        return;
      }
      els["action-dialog"].close();
      await deleteOccurrence(item.id, button.dataset.scope);
    });
  });
  els["action-dialog"].showModal();
}

function deleteOptionsFor(item) {
  if (item.type === "Fixa") {
    return {
      copy: "Escolha se a fixa sai so deste mes, deste mes em diante ou de todos os meses.",
      actions: [
        { scope: "single", label: "Somente este mes" },
        { scope: "from", label: "Deste mes em diante" },
        { scope: "all", label: "Todos os meses", primary: true },
      ],
    };
  }
  if (item.type === "Parcela") {
    return {
      copy: "Escolha se remove so esta parcela, desta parcela em diante ou todas as parcelas.",
      actions: [
        { scope: "single", label: "Somente esta parcela" },
        { scope: "from", label: "Desta parcela em diante" },
        { scope: "all", label: "Todas as parcelas", primary: true },
      ],
    };
  }
  return {
    copy: "Este lancamento sera removido.",
    actions: [{ scope: "all", label: "Remover", primary: true }],
  };
}

async function deleteOccurrence(id, scope) {
  try {
    await readJson(await fetch("/api/delete", postOptions({ occurrenceId: id, scope })));
    showToast("Lancamento removido.");
    await loadState();
  } catch (error) {
    showToast(error.message || "Nao foi possivel remover.");
  }
}

function createCategory() {
  openTextDialog("Nova categoria", "Nome da categoria", "", async (value) => {
    await readJson(await fetch("/api/categories", postOptions({ name: value })));
    showToast("Categoria salva.");
    await loadState();
  });
}

function editInitialInvested() {
  const current = state.data.summary.initial_invested.label;
  openTextDialog("Investido inicial", "Valor investido inicial", current, async (value) => {
    await readJson(await fetch("/api/settings/initial-invested", postOptions({ amount: value })));
    showToast("Investido inicial atualizado.");
    await loadState();
  });
}

function renderProfile() {
  if (!state.data) return;
  const user = state.session?.user ?? state.data.user ?? {};
  els["profile-username"].value = user.username || "";
  els["profile-display-name"].value = user.displayName || "";

  const categories = state.data.categoryItems ?? state.data.categories.map((name) => ({
    id: null,
    name,
    isDefault: false,
  }));

  els["profile-category-list"].innerHTML = categories
    .map((category) => {
      const badge = category.isDefault ? "Padrao" : "Criada";
      const action = category.isDefault
        ? `<span class="muted-text">Protegida</span>`
        : `<button class="button compact ghost" type="button" onclick="deleteCategory(${category.id})">Remover</button>`;
      return `
        <div class="category-row">
          <div>
            <strong>${escapeHtml(category.name)}</strong>
            <span>${badge}</span>
          </div>
          ${action}
        </div>
      `;
    })
    .join("");
}

async function submitProfile(event) {
  event.preventDefault();
  try {
    const data = await readJson(
      await fetch("/api/profile", postOptions({ displayName: els["profile-display-name"].value }))
    );
    updateSessionUser(data.user);
    showToast("Perfil atualizado.");
    await loadState();
  } catch (error) {
    showToast(error.message || "Nao foi possivel atualizar o perfil.");
  }
}

async function submitPassword(event) {
  event.preventDefault();
  const currentPassword = els["password-current"].value;
  const newPassword = els["password-new"].value;
  const confirmation = els["password-confirm"].value;

  if (newPassword !== confirmation) {
    showToast("As senhas novas nao conferem.");
    return;
  }

  try {
    const client = requireSupabase();
    if (currentPassword && state.session?.authEmail) {
      const { error: loginError } = await client.auth.signInWithPassword({
        email: state.session.authEmail,
        password: currentPassword,
      });
      if (loginError) throw new Error("Senha atual invalida.");
    }
    const { error } = await client.auth.updateUser({ password: newPassword });
    if (error) throw error;
    const { data } = await client.auth.getSession();
    if (data.session) {
      saveSupabaseSession(data.session, data.session.user);
    }
    els["password-form"].reset();
    showToast("Senha alterada.");
  } catch (error) {
    showToast(error.message || "Nao foi possivel alterar a senha.");
  }
}

async function deleteCategory(id) {
  if (!id) {
    showToast("Categoria invalida.");
    return;
  }

  const category = state.data.categoryItems.find((item) => item.id === id);
  if (!category) {
    showToast("Categoria nao encontrada.");
    return;
  }

  if (!window.confirm(`Remover a categoria "${category.name}"?`)) {
    return;
  }

  try {
    await readJson(await fetch(`/api/categories/${id}/delete`, postOptions({})));
    showToast("Categoria removida.");
    await loadState();
  } catch (error) {
    showToast(error.message || "Nao foi possivel remover a categoria.");
  }
}

async function loadAdminUsers() {
  if (!state.session?.user?.isAdmin) return;
  try {
    const data = await readJson(await fetch("/api/admin/users", { headers: authHeaders() }));
    state.adminUsers = data.users ?? [];
    renderAdminUsers();
  } catch (error) {
    showToast(error.message || "Nao foi possivel carregar as contas.");
  }
}

function renderAdminUsers() {
  if (!els["admin-user-rows"]) return;
  if (!state.session?.user?.isAdmin) {
    els["admin-user-rows"].innerHTML = emptyRow(7);
    return;
  }

  els["admin-user-rows"].innerHTML = state.adminUsers
    .map((user) => {
      const status = user.disabledAt ? "Desativada" : "Ativa";
      const statusClass = user.disabledAt ? "open" : "paid";
      const action = user.isCurrentUser
        ? `<span class="muted-text">Conta atual</span>`
        : user.disabledAt
          ? `<button class="button compact ghost" type="button" onclick="adminUserAction(${user.id}, 'enable')">Reativar</button>`
          : `<button class="button compact" type="button" onclick="adminUserAction(${user.id}, 'disable')">Desativar</button>`;
      const aiChecked = user.features?.ai_chat ? "checked" : "";

      return `
        <tr>
          <td>${escapeHtml(user.username)}</td>
          <td>${escapeHtml(user.email || "-")}</td>
          <td>${escapeHtml(user.displayName || "-")}</td>
          <td>${user.isAdmin ? "Admin" : "Usuario"}</td>
          <td><span class="pill ${statusClass}">${status}</span></td>
          <td>
            <label class="toggle-cell">
              <input type="checkbox" ${aiChecked} onchange="toggleUserFeature(${user.id}, 'ai_chat', this.checked)" />
              <span>IA</span>
            </label>
          </td>
          <td>${action}</td>
        </tr>
      `;
    })
    .join("") || emptyRow(7);
}

async function adminUserAction(id, action) {
  const label = action === "disable" ? "desativar" : "reativar";
  if (action === "disable" && !window.confirm(`Tem certeza que quer ${label} esta conta?`)) {
    return;
  }

  try {
    await readJson(await fetch(`/api/admin/users/${id}`, postOptions({ action })));
    showToast(action === "disable" ? "Conta desativada." : "Conta reativada.");
    await loadAdminUsers();
  } catch (error) {
    showToast(error.message || "Nao foi possivel atualizar a conta.");
  }
}

async function toggleUserFeature(id, key, enabled) {
  try {
    await readJson(await fetch(`/api/admin/users/${id}`, postOptions({ action: "feature", key, enabled })));
    await loadAdminUsers();
  } catch (error) {
    showToast(error.message || "Nao foi possivel alterar a feature.");
    await loadAdminUsers();
  }
}

function openTextDialog(title, label, initialValue, onSave) {
  els["text-dialog-title"].textContent = title;
  els["text-dialog-label"].textContent = label;
  els["text-dialog-input"].value = initialValue;
  els["text-dialog-form"].onsubmit = async (event) => {
    event.preventDefault();
    const value = els["text-dialog-input"].value.trim();
    if (!value) {
      showToast("Informe um valor.");
      return;
    }
    els["text-dialog"].close();
    try {
      await onSave(value);
    } catch (error) {
      showToast(error.message || "Nao foi possivel salvar.");
    }
  };
  els["text-dialog"].showModal();
  els["text-dialog-input"].focus();
}

function drawCharts() {
  if (!state.data) return;
  drawCategoryChart(els["category-chart"], state.data.categoryTotals);
  drawYearChart(els["year-chart"], state.data.yearlyTotals);
  drawCategoryChart(els["category-large-chart"], state.data.categoryTotals, true);
  drawYearChart(els["year-large-chart"], state.data.yearlyTotals, true);
}

function drawCategoryChart(canvas, rows, large = false) {
  const ctx = setupCanvas(canvas);
  const { width, height } = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#151922";
  ctx.fillRect(0, 0, width, height);

  if (!rows.length) {
    drawEmpty(ctx, width, height, "Sem despesas neste mes");
    return;
  }

  const colors = ["#2dd4bf", "#38bdf8", "#a78bfa", "#f59e0b", "#fb7185", "#34d399", "#e879f9"];
  const max = Math.max(...rows.map((row) => row.totalCents));
  const rowHeight = large ? 42 : 34;
  const labelWidth = large ? 180 : 140;
  const rightPad = large ? 132 : 112;
  const barMax = Math.max(80, width - labelWidth - rightPad);

  rows.slice(0, large ? 10 : 7).forEach((row, index) => {
    const y = 24 + index * rowHeight;
    const barWidth = Math.max(4, (row.totalCents / max) * barMax);
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "700 13px Segoe UI";
    ctx.fillText(row.category, 18, y + 16);
    ctx.fillStyle = colors[index % colors.length];
    roundedRect(ctx, labelWidth, y, barWidth, 20, 5);
    ctx.fill();
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "12px Segoe UI";
    ctx.textAlign = "right";
    ctx.fillText(row.total, width - 18, y + 15);
    ctx.textAlign = "left";
  });
}

function drawYearChart(canvas, rows, large = false) {
  const ctx = setupCanvas(canvas);
  const { width, height } = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#151922";
  ctx.fillRect(0, 0, width, height);

  const max = Math.max(1, ...rows.flatMap((row) => [row.incomeCents, row.expensesCents]));
  const left = 36;
  const right = width - 18;
  const top = large ? 44 : 30;
  const bottom = height - 38;
  const chartHeight = bottom - top;
  const slot = (right - left) / 12;
  const bar = Math.max(6, Math.min(16, slot / 4));

  ctx.font = "700 12px Segoe UI";
  ctx.fillStyle = "#34d399";
  ctx.fillText("Recebido", left, 18);
  ctx.fillStyle = "#fb7185";
  ctx.fillText("Despesas", left + 86, 18);
  ctx.strokeStyle = "#334155";
  ctx.beginPath();
  ctx.moveTo(left, bottom);
  ctx.lineTo(right, bottom);
  ctx.stroke();

  rows.forEach((row, index) => {
    const x = left + index * slot + slot / 2;
    const incomeHeight = (row.incomeCents / max) * chartHeight;
    const expenseHeight = (row.expensesCents / max) * chartHeight;
    ctx.fillStyle = "#34d399";
    roundedRect(ctx, x - bar - 1, bottom - incomeHeight, bar, incomeHeight, 4);
    ctx.fill();
    ctx.fillStyle = "#fb7185";
    roundedRect(ctx, x + 1, bottom - expenseHeight, bar, expenseHeight, 4);
    ctx.fill();
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "11px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText(row.monthName.slice(0, 3), x, bottom + 18);
    ctx.textAlign = "left";
  });
}

function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, Math.abs(height) / 2, Math.abs(width) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawEmpty(ctx, width, height, label) {
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "700 15px Segoe UI";
  ctx.textAlign = "center";
  ctx.fillText(label, width / 2, height / 2);
  ctx.textAlign = "left";
}

function switchView(view) {
  if (view === "admin" && !state.session?.user?.isAdmin) {
    showToast("Acesso de admin necessario.");
    return;
  }
  state.view = view;
  document.querySelectorAll(".view").forEach((item) => item.classList.remove("active"));
  document.getElementById(`${view}-view`).classList.add("active");
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  if (view === "admin") {
    loadAdminUsers();
  }
  requestAnimationFrame(drawCharts);
}

function postOptions(payload, includeAuth = true) {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(includeAuth ? authHeaders() : {}),
    },
    body: JSON.stringify(payload),
  };
}

async function readJson(response) {
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }
  if (!response.ok) {
    if (response.status === 401) {
      logout();
    }
    throw new Error(data.error || "Erro inesperado.");
  }
  return data;
}

function authHeaders() {
  return state.session?.token ? { Authorization: `Bearer ${state.session.token}` } : {};
}

function requireSupabase() {
  if (!supabaseClient) {
    throw new Error("Supabase nao foi carregado.");
  }
  return supabaseClient;
}

function dateInputToUserDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove("visible"), 2600);
}

function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
