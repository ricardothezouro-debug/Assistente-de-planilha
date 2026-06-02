const state = {
  month: new Date().getMonth() + 1,
  year: 2026,
  data: null,
  view: "dashboard",
};

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  bindElements();
  bindEvents();
  loadState();
});

function bindElements() {
  const ids = [
    "page-title",
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
  els["entry-type"].addEventListener("change", syncInstallmentsVisibility);
  els["entry-form"].addEventListener("submit", submitEntry);
  els["new-category-button"].addEventListener("click", createCategory);
  els["edit-invested-button"].addEventListener("click", editInitialInvested);
  els["text-cancel-button"].addEventListener("click", () => els["text-dialog"].close());
  window.addEventListener("resize", debounce(drawCharts, 120));
}

async function loadState() {
  try {
    const response = await fetch(`/api/state?year=${state.year}&month=${state.month}`);
    const data = await readJson(response);
    state.data = data;
    state.year = data.selectedYear;
    state.month = data.selectedMonth;
    render();
  } catch (error) {
    showToast(error.message || "Nao foi possivel carregar os dados.");
  }
}

function render() {
  fillFilters();
  fillFormOptions();
  renderSummary();
  renderTables();
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
  fillSelect(els["entry-status"], data.statuses, els["entry-status"].value || "Auto");
  if (!els["entry-date"].value) {
    els["entry-date"].value = data.today;
  }
  syncInstallmentsVisibility();
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

function renderSummary() {
  const summary = state.data.summary;
  const metrics = [
    ["Recebido", summary.income.label, "good"],
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
      <td>${statusPill(item.status)}</td>
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
      <td>${statusPill(item.status)}</td>
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

function statusPill(status) {
  const cls = status === "Pago" ? "paid" : "open";
  return `<span class="pill ${cls}">${status}</span>`;
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
  syncInstallmentsVisibility();
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
  state.view = view;
  document.querySelectorAll(".view").forEach((item) => item.classList.remove("active"));
  document.getElementById(`${view}-view`).classList.add("active");
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  requestAnimationFrame(drawCharts);
}

function postOptions(payload) {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

async function readJson(response) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Erro inesperado.");
  }
  return data;
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
