const state = {
  month: new Date().getMonth() + 1,
  year: 2026,
  data: null,
  view: "dashboard",
  session: null,
  passwordRecovery: false,
  adminUsers: [],
  adminInvites: [],
  auditEvents: [],
  adminTab: "users",
  inviteToken: "",
  invitePreview: null,
  sidebarCollapsed: false,
};

const els = {};
const SUPABASE_URL = "https://yrarkwxaivsqsnpgabmh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_RYJDWtHHQKmb9bIrrw9IIA_wY3u8GiD";
const INVITE_STORAGE_KEY = "financeiro-invite-token";
const SIDEBAR_STORAGE_KEY = "financeiro-sidebar-collapsed";
let supabaseClient = null;

document.addEventListener("DOMContentLoaded", () => {
  captureInviteToken();
  restoreSidebarState();
  supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) ?? null;
  bindElements();
  bindEvents();
  bootSession();
});

function bindElements() {
  const ids = [
    "page-kicker",
    "page-title",
    "page-subtitle",
    "auth-shell",
    "app-shell",
    "login-tab",
    "register-tab",
    "login-form",
    "register-form",
    "invite-note",
    "login-username",
    "login-password",
    "forgot-password-button",
    "google-login-button",
    "register-email",
    "register-username",
    "register-password",
    "register-confirm",
    "register-submit-button",
    "password-strength-fill",
    "password-strength-label",
    "password-match-label",
    "password-rule-length",
    "password-rule-lower",
    "password-rule-upper",
    "password-rule-number",
    "password-rule-symbol",
    "reset-form",
    "reset-password",
    "reset-confirm",
    "reset-cancel-button",
    "auth-separator",
    "sidebar-toggle",
    "cloud-note",
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
    "profile-password-strength-fill",
    "profile-password-strength-label",
    "profile-password-match-label",
    "profile-password-rule-length",
    "profile-password-rule-lower",
    "profile-password-rule-upper",
    "profile-password-rule-number",
    "profile-password-rule-symbol",
    "profile-category-list",
    "admin-refresh-button",
    "admin-user-rows",
    "invite-form",
    "invite-email",
    "invite-days",
    "admin-invite-rows",
    "admin-log-rows",
    "backup-button",
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
    "account-success-dialog",
    "account-success-message",
    "account-success-ok-button",
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
  els["register-password"].addEventListener("input", renderRegisterPasswordStrength);
  els["register-confirm"].addEventListener("input", renderRegisterPasswordStrength);
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
  els["password-new"].addEventListener("input", renderProfilePasswordStrength);
  els["password-confirm"].addEventListener("input", renderProfilePasswordStrength);
  els["sidebar-toggle"].addEventListener("click", toggleSidebar);
  els["admin-refresh-button"].addEventListener("click", loadAdminData);
  els["invite-form"].addEventListener("submit", submitInvite);
  els["backup-button"].addEventListener("click", downloadBackup);
  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.addEventListener("click", () => switchAdminTab(button.dataset.adminTab));
  });
  els["edit-invested-button"].addEventListener("click", editInitialInvested);
  els["text-cancel-button"].addEventListener("click", () => els["text-dialog"].close());
  els["account-success-ok-button"].addEventListener("click", () => {
    els["account-success-dialog"].close();
    switchAuthMode("login");
    renderAuthState();
    showToast("Enviamos um email de confirmação de conta, se a confirmação estiver ativa no Supabase.");
    els["login-password"].focus();
  });
  window.addEventListener("resize", debounce(drawCharts, 120));
  renderRegisterPasswordStrength();
  renderProfilePasswordStrength();
  applySidebarState();

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
      clearInviteToken();
    }
    state.year = data.selectedYear;
    state.month = data.selectedMonth;
    render();
  } catch (error) {
    showToast(error.message || "Não foi possível carregar os dados.");
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
    showToast("Sessão iniciada.");
    await loadState();
  } catch (error) {
    showToast(error.message || "Não foi possível entrar.");
  }
}

async function submitRegister(event) {
  event.preventDefault();
  if (!state.inviteToken || state.invitePreview?.valid === false) {
    showToast("Cadastro permitido somente por convite válido.");
    return;
  }
  try {
    const client = requireSupabase();
    const email = els["register-email"].value.trim();
    const username = els["register-username"].value.trim();
    const password = els["register-password"].value;
    const confirmation = els["register-confirm"].value;
    const strength = evaluatePassword(password);
    if (!strength.valid) {
      showToast("Use uma senha mais forte antes de criar a conta.");
      renderRegisterPasswordStrength();
      return;
    }
    if (password !== confirmation) {
      showToast("As senhas digitadas não conferem.");
      renderRegisterPasswordStrength();
      return;
    }
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: username ? { username } : {},
        emailRedirectTo: inviteRedirectUrl(),
      },
    });
    if (error) throw error;
    if (data.session) {
      await client.auth.signOut();
      state.session = null;
      localStorage.removeItem("financeiro-session");
    }
    els["login-username"].value = email;
    els["login-password"].value = "";
    els["register-form"].reset();
    els["register-email"].value = state.invitePreview?.email || email;
    renderRegisterPasswordStrength();
    if (!data.session) {
      showAccountCreatedDialog("Conta criada. Se o Supabase pedir confirmação, confirme pelo email antes de entrar.");
      return;
    }
    renderAuthState();
    showAccountCreatedDialog("Conta criada. Entre com seu email e senha para ativar sua planilha.");
  } catch (error) {
    showToast(error.message || "Não foi possível criar a conta.");
  }
}

function evaluatePassword(password) {
  const rules = {
    length: password.length >= 8,
    lower: /[a-z]/.test(password),
    upper: /[A-Z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
  const score = Object.values(rules).filter(Boolean).length;
  return {
    rules,
    score,
    valid: score === 5,
    label: score <= 2 ? "Senha fraca" : score <= 4 ? "Senha média" : "Senha forte",
  };
}

function renderRegisterPasswordStrength() {
  if (!els["register-password"] || !els["password-strength-fill"]) return;
  const valid = renderPasswordStrength({
    passwordInput: els["register-password"],
    confirmInput: els["register-confirm"],
    fill: els["password-strength-fill"],
    label: els["password-strength-label"],
    matchLabel: els["password-match-label"],
    rulePrefix: "password-rule",
  });
  els["register-submit-button"].disabled = !valid;
}

function renderProfilePasswordStrength() {
  if (!els["password-new"] || !els["profile-password-strength-fill"]) return false;
  return renderPasswordStrength({
    passwordInput: els["password-new"],
    confirmInput: els["password-confirm"],
    fill: els["profile-password-strength-fill"],
    label: els["profile-password-strength-label"],
    matchLabel: els["profile-password-match-label"],
    rulePrefix: "profile-password-rule",
  });
}

function renderPasswordStrength({ passwordInput, confirmInput, fill, label, matchLabel, rulePrefix }) {
  const password = passwordInput.value || "";
  const confirmation = confirmInput.value || "";
  const strength = evaluatePassword(password);
  const width = `${Math.max(8, strength.score * 20)}%`;

  fill.style.width = password ? width : "0%";
  fill.classList.toggle("medium", strength.score >= 3 && strength.score < 5);
  fill.classList.toggle("strong", strength.valid);
  label.textContent = password ? strength.label : "Senha muito fraca";

  const matches = Boolean(password && confirmation && password === confirmation);
  matchLabel.textContent = matches
    ? "Senhas iguais"
    : confirmation
      ? "Senhas diferentes"
      : "Confirme a senha";
  confirmInput.classList.toggle("invalid", Boolean(confirmation && !matches));

  Object.entries(strength.rules).forEach(([key, valid]) => {
    els[`${rulePrefix}-${key}`]?.classList.toggle("valid", valid);
  });
  return strength.valid && matches;
}

function showAccountCreatedDialog(message) {
  els["account-success-message"].textContent = message;
  renderAuthState();
  if (els["account-success-dialog"].showModal) {
    els["account-success-dialog"].showModal();
  } else {
    window.alert(message);
    switchAuthMode("login");
    renderAuthState();
  }
}

async function loginWithGoogle() {
  try {
    const client = requireSupabase();
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: inviteRedirectUrl(),
      },
    });
    if (error) throw error;
  } catch (error) {
    showToast(error.message || "Não foi possível iniciar o Google Login.");
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
    showToast("Enviamos o link de redefinição para seu email.");
  } catch (error) {
    showToast(error.message || "Não foi possível enviar o email.");
  }
}

async function submitPasswordRecovery(event) {
  event.preventDefault();
  const password = els["reset-password"].value;
  const confirmation = els["reset-confirm"].value;

  if (password !== confirmation) {
    showToast("As senhas não conferem.");
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
    showToast(error.message || "Não foi possível redefinir a senha.");
  }
}

async function bootSession() {
  const isRecovery = isPasswordRecoveryUrl();
  await loadInvitePreview();
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

function captureInviteToken() {
  const token = new URLSearchParams(window.location.search).get("invite")?.trim();
  if (token) {
    state.inviteToken = token;
    localStorage.setItem(INVITE_STORAGE_KEY, token);
    return;
  }
  state.inviteToken = localStorage.getItem(INVITE_STORAGE_KEY) || "";
}

async function loadInvitePreview() {
  if (!state.inviteToken) return;
  try {
    const data = await readJson(
      await fetch(`/api/invites/preview?token=${encodeURIComponent(state.inviteToken)}`)
    );
    state.invitePreview = data;
    if (data.email) {
      els["register-email"].value = data.email;
      els["register-email"].readOnly = true;
      els["login-username"].value = data.email;
    }
    switchAuthMode("register");
  } catch (error) {
    state.invitePreview = { valid: false, error: error.message };
    showToast(error.message || "Convite inválido.");
  }
}

function clearInviteToken() {
  if (!state.inviteToken) return;
  state.inviteToken = "";
  state.invitePreview = null;
  els["register-email"].readOnly = false;
  localStorage.removeItem(INVITE_STORAGE_KEY);
  if (new URLSearchParams(window.location.search).has("invite")) {
    clearAuthUrl();
  }
}

function inviteRedirectUrl() {
  if (!state.inviteToken) return window.location.origin;
  return `${window.location.origin}/?invite=${encodeURIComponent(state.inviteToken)}`;
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
      username: user.user_metadata?.username || user.email || "Usuário",
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
  const hasInvite = Boolean(state.inviteToken && state.invitePreview?.valid !== false);
  els["auth-shell"].classList.toggle("hidden", isLoggedIn && !state.passwordRecovery);
  els["app-shell"].classList.toggle("hidden", !isLoggedIn || state.passwordRecovery);
  els["register-tab"].classList.toggle("hidden", !hasInvite || state.passwordRecovery);
  els["invite-note"].textContent = hasInvite
    ? `Convite ativo para ${state.invitePreview?.email || "este email"}.`
    : "Novas contas entram somente por convite.";
  if (isLoggedIn) {
    const user = state.session.user ?? {};
    els["current-user"].textContent = user.displayName || user.username || "Usuário";
    els["admin-nav-item"].classList.toggle("hidden", !user.isAdmin);
    els["cloud-note"].classList.toggle("hidden", !user.isAdmin);
    if (!user.isAdmin && state.view === "admin") {
      switchView("dashboard");
    }
  } else {
    els["admin-nav-item"].classList.add("hidden");
    els["cloud-note"].classList.add("hidden");
  }
}

function switchAuthMode(mode) {
  if (mode === "register" && !state.inviteToken) {
    mode = "login";
  }
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
  renderAdminInvites();
  renderAuditEvents();
  drawCharts();
}

function fillFilters() {
  const data = state.data;
  renderPageHeader();
  els["month-filter"].innerHTML = data.monthNames
    .map((name, index) => `<option value="${index + 1}">${name}</option>`)
    .join("");
  els["month-filter"].value = String(state.month);
  els["year-filter"].value = String(state.year);
}

function renderPageHeader() {
  if (!state.data) return;
  const monthTitle = `${state.data.monthNames[state.month - 1]} ${state.year}`;
  const copy = {
    dashboard: {
      kicker: "Visão mensal",
      title: monthTitle,
      subtitle: "Acompanhe receitas, despesas e compromissos do mês.",
    },
    launch: {
      kicker: "Registros",
      title: "Lançamentos",
      subtitle: `Gerencie entradas, parcelas e pagamentos de ${monthTitle}.`,
    },
    charts: {
      kicker: "Analytics",
      title: "Análise gráfica",
      subtitle: "Visualize categorias, fluxo anual e equilíbrio financeiro.",
    },
    profile: {
      kicker: "Conta",
      title: "Perfil",
      subtitle: "Gerencie suas informações pessoais, senha e categorias.",
    },
    admin: {
      kicker: "Admin",
      title: "Painel de controle",
      subtitle: "Acompanhe usuários, convites, logs e backups.",
    },
  };
  const current = copy[state.view] || copy.dashboard;
  els["page-kicker"].textContent = current.kicker;
  els["page-title"].textContent = current.title;
  els["page-subtitle"].textContent = current.subtitle;
}

function fillFormOptions() {
  const data = state.data;
  fillSelect(els["entry-type"], data.entryTypes, els["entry-type"].value || "Variavel", displayEntryType);
  fillSelect(els["entry-category"], data.categories, els["entry-category"].value || "Outros", displayCategory);
  syncStatusOptions();
  if (!els["entry-date"].value) {
    els["entry-date"].value = data.today;
  }
  syncEntryTypeFields();
}

function fillSelect(select, values, preferred = "", labeler = (value) => value) {
  const current = preferred || select.value;
  select.innerHTML = values
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(labeler(value))}</option>`)
    .join("");
  if (values.includes(current)) {
    select.value = current;
  }
}

function displayEntryType(value) {
  return value === "Variavel" ? "Variável" : value;
}

function displayCategory(value) {
  return value === "Saude" ? "Saúde" : value;
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
    { value: "Nao pago", label: isIncome ? "Não recebido" : "Não pago" },
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
    ["Recebido", summary.income.label, "good", "arrow_upward"],
    ["A receber", summary.receivable_income.label, summary.receivable_income.cents > 0 ? "warn" : "", "pending_actions"],
    ["Despesas", summary.expenses.label, summary.expenses.cents > 0 ? "bad" : "", "arrow_downward"],
    ["Em aberto", summary.open_expenses.label, summary.open_expenses.cents > 0 ? "warn" : "", "schedule"],
    ["Sobra", summary.balance.label, summary.balance.cents >= 0 ? "good" : "bad", "account_balance_wallet"],
    ["Investido no mês", summary.invested_month.label, "good", "trending_up"],
    ["Investido inicial", summary.initial_invested.label, "", "account_balance"],
    ["Investido no ano", summary.invested_year.label, "good", "savings"],
    ["Pagas", summary.paid_expenses.label, "", "task_alt"],
  ];
  els["summary-grid"].innerHTML = metrics
    .map(
      ([label, value, tone, icon]) => `
        <article class="metric" data-tone="${tone}">
          <div class="metric-head">
            <span class="metric-icon"><span class="material-symbols-outlined">${icon}</span></span>
            <span>${label}</span>
          </div>
          <strong>${value}</strong>
        </article>
      `
    )
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
      <td>${escapeHtml(displayCategory(item.category))}</td>
      <td class="amount">${item.amount}</td>
      <td>${statusPill(item.status, item.type)}</td>
    </tr>
  `;
}

function renderOccurrenceRow(item) {
  return `
    <tr>
      <td>${item.dateLabel}</td>
      <td>${displayEntryType(item.type)}</td>
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(displayCategory(item.category))}</td>
      <td>${item.installment || "-"}</td>
      <td class="amount">${item.amount}</td>
      <td>${statusPill(item.status, item.type)}</td>
      <td>
        <div class="row-actions">
          <button class="button compact ghost" type="button" onclick="toggleOccurrence(${item.id})">Status</button>
          <button class="button compact" type="button" onclick="openDeleteDialogById(${item.id})">
            <span class="material-symbols-outlined">delete</span>
            <span>Remover</span>
          </button>
        </div>
      </td>
    </tr>
  `;
}

function emptyRow(columns) {
  return `<tr><td colspan="${columns}">Nenhum lançamento para este período.</td></tr>`;
}

function statusPill(status, type) {
  const cls = status === "Pago" ? "paid" : "open";
  return `<span class="pill ${cls}">${displayStatus(status, type)}</span>`;
}

function displayStatus(status, type) {
  if (type === "Recebido") {
    return status === "Pago" ? "Recebido" : "Não recebido";
  }
  return status;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
    showToast("Lançamento criado.");
    await loadState();
  } catch (error) {
    showToast(error.message || "Não foi possível lançar.");
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
    showToast(error.message || "Não foi possível atualizar.");
  }
}

function openDeleteDialogById(id) {
  const item = state.data.occurrences.find((occurrence) => occurrence.id === id);
  if (!item) {
    showToast("Lançamento não encontrado.");
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
      copy: "Escolha se a fixa sai só deste mês, deste mês em diante ou de todos os meses.",
      actions: [
        { scope: "single", label: "Somente este mês" },
        { scope: "from", label: "Deste mês em diante" },
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
    copy: "Este lançamento será removido.",
    actions: [{ scope: "all", label: "Remover", primary: true }],
  };
}

async function deleteOccurrence(id, scope) {
  try {
    await readJson(await fetch("/api/delete", postOptions({ occurrenceId: id, scope })));
    showToast("Lançamento removido.");
    await loadState();
  } catch (error) {
    showToast(error.message || "Não foi possível remover.");
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
      const badge = category.isDefault ? "Padrão" : "Criada";
      const action = category.isDefault
        ? `<span class="muted-text">Protegida</span>`
        : `<button class="button compact ghost" type="button" onclick="deleteCategory(${category.id})">Remover</button>`;
      return `
        <div class="category-row">
          <div>
            <strong>${escapeHtml(displayCategory(category.name))}</strong>
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
    showToast(error.message || "Não foi possível atualizar o perfil.");
  }
}

async function submitPassword(event) {
  event.preventDefault();
  const currentPassword = els["password-current"].value;
  const newPassword = els["password-new"].value;
  const confirmation = els["password-confirm"].value;

  if (newPassword !== confirmation) {
    showToast("As senhas novas não conferem.");
    renderProfilePasswordStrength();
    return;
  }

  const strength = evaluatePassword(newPassword);
  if (!strength.valid) {
    showToast("Use uma senha mais forte antes de alterar.");
    renderProfilePasswordStrength();
    return;
  }

  try {
    const client = requireSupabase();
    if (currentPassword && state.session?.authEmail) {
      const { error: loginError } = await client.auth.signInWithPassword({
        email: state.session.authEmail,
        password: currentPassword,
      });
      if (loginError) throw new Error("Senha atual inválida.");
    }
    const { error } = await client.auth.updateUser({ password: newPassword });
    if (error) throw error;
    const { data } = await client.auth.getSession();
    if (data.session) {
      saveSupabaseSession(data.session, data.session.user);
    }
    els["password-form"].reset();
    renderProfilePasswordStrength();
    showToast("Senha alterada.");
  } catch (error) {
    showToast(error.message || "Não foi possível alterar a senha.");
  }
}

async function deleteCategory(id) {
  if (!id) {
    showToast("Categoria inválida.");
    return;
  }

  const category = state.data.categoryItems.find((item) => item.id === id);
  if (!category) {
    showToast("Categoria não encontrada.");
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
    showToast(error.message || "Não foi possível remover a categoria.");
  }
}

async function loadAdminUsers() {
  if (!state.session?.user?.isAdmin) return;
  try {
    const data = await readJson(await fetch("/api/admin/users", { headers: authHeaders() }));
    state.adminUsers = data.users ?? [];
    renderAdminUsers();
  } catch (error) {
    showToast(error.message || "Não foi possível carregar as contas.");
  }
}

async function loadAdminInvites() {
  if (!state.session?.user?.isAdmin) return;
  const data = await readJson(await fetch("/api/admin/invites", { headers: authHeaders() }));
  state.adminInvites = data.invites ?? [];
  renderAdminInvites();
}

async function loadAuditEvents() {
  if (!state.session?.user?.isAdmin) return;
  const data = await readJson(await fetch("/api/admin/audit-events?limit=50", { headers: authHeaders() }));
  state.auditEvents = data.events ?? [];
  renderAuditEvents();
}

async function loadAdminData() {
  if (!state.session?.user?.isAdmin) return;
  try {
    await Promise.all([loadAdminUsers(), loadAdminInvites(), loadAuditEvents()]);
  } catch (error) {
    showToast(error.message || "Não foi possível carregar o admin.");
  }
}

function renderAdminUsers() {
  if (!els["admin-user-rows"]) return;
  if (!state.session?.user?.isAdmin) {
    els["admin-user-rows"].innerHTML = emptyRow(8);
    return;
  }

  els["admin-user-rows"].innerHTML = state.adminUsers
    .map((user) => {
      const status = user.disabledAt ? "Desativada" : "Ativa";
      const statusClass = user.disabledAt ? "open" : "paid";
      const action = adminUserActions(user);
      const aiChecked = user.features?.ai_chat ? "checked" : "";

      return `
        <tr>
          <td>${escapeHtml(user.username)}</td>
          <td>${escapeHtml(user.email || "-")}</td>
          <td>${escapeHtml(user.displayName || "-")}</td>
          <td>${user.isAdmin ? "Admin" : "Usuário"}</td>
          <td><span class="pill ${statusClass}">${status}</span></td>
          <td>${user.invite ? escapeHtml(user.invite.email) : "-"}</td>
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
    .join("") || emptyRow(8);
}

function adminUserActions(user) {
  if (user.isCurrentUser) {
    return `<span class="muted-text">Conta atual</span>`;
  }
  if (user.isAdmin) {
    return `<span class="muted-text">Admin protegido</span>`;
  }
  const statusButton = user.disabledAt
    ? `<button class="button compact ghost" type="button" onclick="adminUserAction(${user.id}, 'enable')">Reativar</button>`
    : `<button class="button compact" type="button" onclick="adminUserAction(${user.id}, 'disable')">Desativar</button>`;
  return `
    <div class="row-actions">
      ${statusButton}
      <button class="button compact danger" type="button" onclick="deleteAdminUser(${user.id})">Deletar</button>
    </div>
  `;
}

function renderAdminInvites() {
  if (!els["admin-invite-rows"]) return;
  els["admin-invite-rows"].innerHTML = state.adminInvites
    .map((invite) => {
      const canRevoke = invite.status === "ativo";
      return `
        <tr>
          <td>${escapeHtml(invite.email)}</td>
          <td>${statusPillForInvite(invite.status)}</td>
          <td>${formatDateTime(invite.expiresAt)}</td>
          <td>${invite.consumedAt ? formatDateTime(invite.consumedAt) : "-"}</td>
          <td>
            ${
              canRevoke
                ? `<button class="button compact ghost" type="button" onclick="revokeInvite(${invite.id})">Revogar</button>`
                : `<span class="muted-text">Sem ação</span>`
            }
          </td>
        </tr>
      `;
    })
    .join("") || emptyRow(5);
}

function renderAuditEvents() {
  if (!els["admin-log-rows"]) return;
  els["admin-log-rows"].innerHTML = state.auditEvents
    .map((event) => `
      <tr>
        <td>${formatDateTime(event.createdAt)}</td>
        <td>${escapeHtml(event.type)}</td>
        <td>${escapeHtml(event.message)}</td>
        <td>${event.targetUserId || "-"}</td>
      </tr>
    `)
    .join("") || emptyRow(4);
}

function statusPillForInvite(status) {
  const cls = status === "ativo" ? "paid" : status === "usado" ? "" : "open";
  return `<span class="pill ${cls}">${escapeHtml(status)}</span>`;
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
    showToast(error.message || "Não foi possível atualizar a conta.");
  }
}

async function toggleUserFeature(id, key, enabled) {
  try {
    await readJson(await fetch(`/api/admin/users/${id}`, postOptions({ action: "feature", key, enabled })));
    await loadAdminUsers();
  } catch (error) {
    showToast(error.message || "Não foi possível alterar a feature.");
    await loadAdminUsers();
  }
}

async function deleteAdminUser(id) {
  const target = state.adminUsers.find((user) => user.id === id);
  if (!target) {
    showToast("Conta não encontrada.");
    return;
  }
  const label = target.email || target.username || `ID ${id}`;
  if (!window.confirm(`Tem certeza que quer deletar a conta ${label}? Todos os dados financeiros dela serao apagados.`)) {
    return;
  }
  const typed = window.prompt(`Para confirmar a exclusao de ${label}, digite DELETAR`);
  if (typed !== "DELETAR") {
    showToast("Exclusao cancelada.");
    return;
  }

  try {
    await readJson(await fetch(`/api/admin/users/${id}`, postOptions({ action: "delete", confirm: "DELETAR" })));
    showToast("Conta deletada.");
    await loadAdminData();
  } catch (error) {
    showToast(error.message || "Não foi possível deletar a conta.");
  }
}

async function submitInvite(event) {
  event.preventDefault();
  try {
    const data = await readJson(
      await fetch(
        "/api/admin/invites",
        postOptions({
          email: els["invite-email"].value,
          expiresInDays: Number(els["invite-days"].value || 7),
        })
      )
    );
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(data.link);
        copied = true;
      }
    } catch {
      copied = false;
    }
    if (!copied) {
      window.prompt("Copie o link do convite:", data.link);
    }
    els["invite-form"].reset();
    els["invite-days"].value = "7";
    const emailCopy = data.emailSent
      ? " Email enviado automaticamente."
      : data.emailError
        ? ` Email não enviado: ${data.emailError}`
        : "";
    showToast(`${copied ? "Convite criado e link copiado." : "Convite criado."}${emailCopy}`);
    await loadAdminInvites();
    await loadAuditEvents();
  } catch (error) {
    showToast(error.message || "Não foi possível criar o convite.");
  }
}

async function revokeInvite(id) {
  if (!window.confirm("Revogar este convite?")) return;
  try {
    await readJson(await fetch(`/api/admin/invites/${id}/revoke`, postOptions({})));
    showToast("Convite revogado.");
    await loadAdminInvites();
    await loadAuditEvents();
  } catch (error) {
    showToast(error.message || "Não foi possível revogar o convite.");
  }
}

async function downloadBackup() {
  try {
    const response = await fetch("/api/admin/backup", { headers: authHeaders() });
    if (!response.ok) {
      await readJson(response);
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `financeiro-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Backup baixado.");
    await loadAuditEvents();
  } catch (error) {
    showToast(error.message || "Não foi possível baixar o backup.");
  }
}

function switchAdminTab(tab) {
  state.adminTab = tab || "users";
  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.adminTab === state.adminTab);
  });
  document.querySelectorAll(".admin-pane").forEach((pane) => pane.classList.remove("active"));
  document.getElementById(`admin-${state.adminTab}-pane`)?.classList.add("active");
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
      showToast(error.message || "Não foi possível salvar.");
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
  ctx.fillStyle = "#0d1320";
  ctx.fillRect(0, 0, width, height);

  if (!rows.length) {
    drawEmpty(ctx, width, height, "Sem despesas neste mês");
    return;
  }

  const colors = ["#2de2c3", "#38bdf8", "#22c55e", "#a78bfa", "#f59e0b", "#fb7185", "#e879f9"];
  const max = Math.max(...rows.map((row) => row.totalCents));
  const rowHeight = large ? 42 : 34;
  const labelWidth = large ? 180 : 140;
  const rightPad = large ? 132 : 112;
  const barMax = Math.max(80, width - labelWidth - rightPad);

  rows.slice(0, large ? 10 : 7).forEach((row, index) => {
    const y = 24 + index * rowHeight;
    const barWidth = Math.max(4, (row.totalCents / max) * barMax);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "700 13px Inter, Segoe UI, sans-serif";
    ctx.fillText(displayCategory(row.category), 18, y + 16);
    const gradient = ctx.createLinearGradient(labelWidth, y, labelWidth + barWidth, y);
    gradient.addColorStop(0, colors[index % colors.length]);
    gradient.addColorStop(1, index % 2 === 0 ? "#38bdf8" : colors[index % colors.length]);
    ctx.fillStyle = gradient;
    roundedRect(ctx, labelWidth, y, barWidth, 20, 5);
    ctx.fill();
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px Inter, Segoe UI, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(row.total, width - 18, y + 15);
    ctx.textAlign = "left";
  });
}

function drawYearChart(canvas, rows, large = false) {
  const ctx = setupCanvas(canvas);
  const { width, height } = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0d1320";
  ctx.fillRect(0, 0, width, height);

  const max = Math.max(1, ...rows.flatMap((row) => [row.incomeCents, row.expensesCents]));
  const left = 36;
  const right = width - 18;
  const top = large ? 44 : 30;
  const bottom = height - 38;
  const chartHeight = bottom - top;
  const slot = (right - left) / 12;
  const bar = Math.max(6, Math.min(16, slot / 4));

  ctx.font = "700 12px Inter, Segoe UI, sans-serif";
  ctx.fillStyle = "#2de2c3";
  ctx.fillText("Recebido", left, 18);
  ctx.fillStyle = "#fb7185";
  ctx.fillText("Despesas", left + 86, 18);
  ctx.strokeStyle = "#1e293b";
  ctx.beginPath();
  ctx.moveTo(left, bottom);
  ctx.lineTo(right, bottom);
  ctx.stroke();

  rows.forEach((row, index) => {
    const x = left + index * slot + slot / 2;
    const incomeHeight = (row.incomeCents / max) * chartHeight;
    const expenseHeight = (row.expensesCents / max) * chartHeight;
    const incomeGradient = ctx.createLinearGradient(0, bottom - incomeHeight, 0, bottom);
    incomeGradient.addColorStop(0, "#2de2c3");
    incomeGradient.addColorStop(1, "#22c55e");
    ctx.fillStyle = incomeGradient;
    roundedRect(ctx, x - bar - 1, bottom - incomeHeight, bar, incomeHeight, 4);
    ctx.fill();
    const expenseGradient = ctx.createLinearGradient(0, bottom - expenseHeight, 0, bottom);
    expenseGradient.addColorStop(0, "#fb7185");
    expenseGradient.addColorStop(1, "#be123c");
    ctx.fillStyle = expenseGradient;
    roundedRect(ctx, x + 1, bottom - expenseHeight, bar, expenseHeight, 4);
    ctx.fill();
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px Inter, Segoe UI, sans-serif";
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
  ctx.fillStyle = "#94a3b8";
  ctx.font = "700 15px Inter, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, width / 2, height / 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function switchView(view) {
  if (view === "admin" && !state.session?.user?.isAdmin) {
    showToast("Acesso de admin necessário.");
    return;
  }
  state.view = view;
  document.querySelectorAll(".view").forEach((item) => item.classList.remove("active"));
  document.getElementById(`${view}-view`).classList.add("active");
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  renderPageHeader();
  if (view === "admin") {
    switchAdminTab(state.adminTab);
    loadAdminData();
  }
  requestAnimationFrame(drawCharts);
}

function restoreSidebarState() {
  state.sidebarCollapsed = localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
}

function toggleSidebar() {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  localStorage.setItem(SIDEBAR_STORAGE_KEY, state.sidebarCollapsed ? "1" : "0");
  applySidebarState();
  requestAnimationFrame(drawCharts);
}

function applySidebarState() {
  if (!els["app-shell"] || !els["sidebar-toggle"]) return;
  els["app-shell"].classList.toggle("sidebar-collapsed", state.sidebarCollapsed);
  els["sidebar-toggle"].setAttribute("aria-label", state.sidebarCollapsed ? "Expandir menu" : "Minimizar menu");
  els["sidebar-toggle"].title = state.sidebarCollapsed ? "Expandir menu" : "Minimizar menu";
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
  const headers = state.session?.token ? { Authorization: `Bearer ${state.session.token}` } : {};
  if (state.inviteToken) {
    headers["X-Invite-Token"] = state.inviteToken;
  }
  return headers;
}

function requireSupabase() {
  if (!supabaseClient) {
    throw new Error("Supabase não foi carregado.");
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
