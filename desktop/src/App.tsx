import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction
} from "react";
import {
  createCategory,
  createEntry,
  deleteOccurrence,
  loadState,
  toggleOccurrence,
  updateInitialInvested
} from "./api";
import type { CategoryTotal, DeleteScope, FinanceState, Occurrence, YearlyTotal } from "./types";

const currentDate = new Date();

type View = "dashboard" | "launch" | "charts";

type EntryForm = {
  type: string;
  name: string;
  amount: string;
  category: string;
  date: string;
  installments: string;
  status: string;
};

type DeleteDialog = {
  item: Occurrence;
} | null;

export function App() {
  const [view, setView] = useState<View>("dashboard");
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [data, setData] = useState<FinanceState | null>(null);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState<EntryForm>({
    type: "Variavel",
    name: "",
    amount: "",
    category: "Outros",
    date: toInputDate(currentDate),
    installments: "2",
    status: "Auto"
  });
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialog>(null);
  const [toast, setToast] = useState("");

  async function refresh() {
    setLoadError("");
    const next = await loadState(year, month);
    setData(next);
    setYear(next.selectedYear);
    setMonth(next.selectedMonth);
    setForm((current) => ({
      ...current,
      date: current.date || next.today,
      category: next.categories.includes(current.category) ? current.category : "Outros"
    }));
  }

  useEffect(() => {
    refresh().catch((error) => {
      const message = error instanceof Error ? error.message : "Nao foi possivel carregar os dados.";
      setLoadError(message);
      showToast(message);
    });
  }, [year, month]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function showToast(message: string) {
    setToast(message);
  }

  async function submitEntry(event: FormEvent) {
    event.preventDefault();
    try {
      await createEntry({
        ...form,
        installments: Number(form.installments || 1),
        date: inputDateToUserDate(form.date)
      });
      setForm({
        type: "Variavel",
        name: "",
        amount: "",
        category: "Outros",
        date: data?.today ?? toInputDate(currentDate),
        installments: "2",
        status: "Auto"
      });
      showToast("Lancamento criado.");
      await refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Nao foi possivel lancar.");
    }
  }

  async function addCategory() {
    const name = window.prompt("Nome da categoria:");
    if (!name) return;
    try {
      const result = await createCategory(name);
      setForm((current) => ({ ...current, category: result.category }));
      showToast("Categoria salva.");
      await refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Nao foi possivel criar.");
    }
  }

  async function editInitialInvested() {
    const initial = data?.summary.initial_invested?.label ?? "";
    const amount = window.prompt("Valor investido inicial:", initial);
    if (!amount) return;
    try {
      await updateInitialInvested(amount);
      showToast("Investido inicial atualizado.");
      await refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Nao foi possivel salvar.");
    }
  }

  async function changeStatus(id: number) {
    try {
      await toggleOccurrence(id);
      await refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Nao foi possivel atualizar.");
    }
  }

  async function removeOccurrence(scope: DeleteScope) {
    if (!deleteDialog) return;
    const occurrenceId = deleteDialog.item.id;
    setDeleteDialog(null);
    try {
      await deleteOccurrence(occurrenceId, scope);
      showToast("Lancamento removido.");
      await refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Nao foi possivel remover.");
    }
  }

  function openDeleteDialog(item: Occurrence) {
    setDeleteDialog({ item });
  }

  const pageTitle = data ? `${data.monthNames[month - 1]} ${year}` : "Carregando";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">F</div>
          <div>
            <strong>Financeiro</strong>
            <span>Desktop</span>
          </div>
        </div>
        <nav className="nav-stack" aria-label="Navegacao">
          <NavButton view="dashboard" current={view} onClick={setView}>Dashboard</NavButton>
          <NavButton view="launch" current={view} onClick={setView}>Lancamentos</NavButton>
          <NavButton view="charts" current={view} onClick={setView}>Graficos</NavButton>
        </nav>
        <div className="side-note">
          <span className="signal" />
          <p>Dados locais salvos neste computador.</p>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Visao mensal</p>
            <h1>{pageTitle}</h1>
          </div>
          {data && (
            <div className="filters">
              <label>
                Mes
                <select value={month} onChange={(event) => setMonth(Number(event.target.value))}>
                  {data.monthNames.map((name, index) => (
                    <option value={index + 1} key={name}>{name}</option>
                  ))}
                </select>
              </label>
              <label>
                Ano
                <input type="number" min="2026" max="2035" value={year} onChange={(event) => setYear(Number(event.target.value))} />
              </label>
              <button className="button ghost" type="button" onClick={() => refresh().catch((error) => showToast(error.message))}>Atualizar</button>
            </div>
          )}
        </header>

        {!data ? (
          <section className="panel loading-state">
            <h2>{loadError ? "API local indisponivel" : "Carregando dados..."}</h2>
            {loadError && (
              <>
                <p>{loadError}</p>
                <button className="button primary compact" type="button" onClick={() => refresh().catch((error) => {
                  const message = error instanceof Error ? error.message : "Nao foi possivel carregar os dados.";
                  setLoadError(message);
                  showToast(message);
                })}>
                  Tentar novamente
                </button>
              </>
            )}
          </section>
        ) : (
          <>
            {view === "dashboard" && (
              <DashboardView
                data={data}
                setView={setView}
                onToggle={changeStatus}
                onDelete={openDeleteDialog}
              />
            )}
            {view === "launch" && (
              <LaunchView
                data={data}
                form={form}
                setForm={setForm}
                onSubmit={submitEntry}
                onCreateCategory={addCategory}
                onEditInitialInvested={editInitialInvested}
                onToggle={changeStatus}
                onDelete={openDeleteDialog}
              />
            )}
            {view === "charts" && <ChartsView data={data} />}
          </>
        )}
      </main>

      {deleteDialog && (
        <DeleteModal
          item={deleteDialog.item}
          onClose={() => setDeleteDialog(null)}
          onDelete={removeOccurrence}
        />
      )}

      <div className={`toast ${toast ? "visible" : ""}`}>{toast}</div>
    </div>
  );
}

function DashboardView({
  data,
  setView,
  onToggle,
  onDelete
}: {
  data: FinanceState;
  setView: (view: View) => void;
  onToggle: (id: number) => void;
  onDelete: (item: Occurrence) => void;
}) {
  return (
    <section className="view active">
      <SummaryGrid data={data} />
      <div className="dashboard-grid">
        <ChartPanel title="Gastos por categoria" eyebrow="Mes atual">
          <CategoryChart rows={data.categoryTotals} />
        </ChartPanel>
        <ChartPanel title="Recebido vs despesas" eyebrow="Ano">
          <YearChart rows={data.yearlyTotals} />
        </ChartPanel>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Agenda</p>
            <h2>Proximos lancamentos do mes</h2>
          </div>
          <button className="button compact" type="button" onClick={() => setView("launch")}>Novo lancamento</button>
        </div>
        <OccurrenceTable
          rows={data.occurrences.slice(0, 8)}
          compact
          onToggle={onToggle}
          onDelete={onDelete}
        />
      </section>
    </section>
  );
}

function LaunchView({
  data,
  form,
  setForm,
  onSubmit,
  onCreateCategory,
  onEditInitialInvested,
  onToggle,
  onDelete
}: {
  data: FinanceState;
  form: EntryForm;
  setForm: Dispatch<SetStateAction<EntryForm>>;
  onSubmit: (event: FormEvent) => void;
  onCreateCategory: () => void;
  onEditInitialInvested: () => void;
  onToggle: (id: number) => void;
  onDelete: (item: Occurrence) => void;
}) {
  const update = (field: keyof EntryForm, value: string) => setForm((current) => ({ ...current, [field]: value }));
  return (
    <section className="launch-grid">
      <section className="panel form-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Entrada rapida</p>
            <h2>Novo lancamento</h2>
          </div>
        </div>
        <form className="entry-form" onSubmit={onSubmit}>
          <label>
            Tipo
            <select value={form.type} onChange={(event) => update("type", event.target.value)}>
              {data.entryTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label>
            Descricao
            <input value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Ex: Mercado, Salario, Jogo" required />
          </label>
          <label>
            Valor
            <input value={form.amount} onChange={(event) => update("amount", event.target.value)} placeholder="R$ 0,00" required />
          </label>
          <label>
            Categoria
            <div className="inline-control">
              <select value={form.category} onChange={(event) => update("category", event.target.value)}>
                {data.categories.map((category) => <option key={category}>{category}</option>)}
              </select>
              <button className="button square" type="button" onClick={onCreateCategory}>+</button>
            </div>
          </label>
          <label>
            Data
            <input type="date" value={form.date} onChange={(event) => update("date", event.target.value)} required />
          </label>
          {form.type === "Parcela" && (
            <label>
              Parcelas
              <input type="number" min="2" max="120" value={form.installments} onChange={(event) => update("installments", event.target.value)} />
            </label>
          )}
          <label>
            Status
            <select value={form.status} onChange={(event) => update("status", event.target.value)}>
              {data.statuses.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
          <button className="button primary" type="submit">Lancar</button>
        </form>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Registros</p>
            <h2>Lancamentos do mes</h2>
          </div>
          <button className="button ghost compact" type="button" onClick={onEditInitialInvested}>Investido inicial</button>
        </div>
        <OccurrenceTable rows={data.occurrences} onToggle={onToggle} onDelete={onDelete} />
      </section>
    </section>
  );
}

function ChartsView({ data }: { data: FinanceState }) {
  return (
    <section className="chart-layout">
      <ChartPanel title="Categorias do mes" eyebrow="Distribuicao">
        <CategoryChart rows={data.categoryTotals} large />
      </ChartPanel>
      <ChartPanel title="Fluxo anual" eyebrow="Tendencia">
        <YearChart rows={data.yearlyTotals} large />
      </ChartPanel>
    </section>
  );
}

function SummaryGrid({ data }: { data: FinanceState }) {
  const items = [
    ["Recebido", data.summary.income.label, "good"],
    ["Despesas", data.summary.expenses.label, data.summary.expenses.cents > 0 ? "bad" : ""],
    ["Em aberto", data.summary.open_expenses.label, data.summary.open_expenses.cents > 0 ? "warn" : ""],
    ["Sobra", data.summary.balance.label, data.summary.balance.cents >= 0 ? "good" : "bad"],
    ["Investido no mes", data.summary.invested_month.label, "good"],
    ["Investido inicial", data.summary.initial_invested.label, ""],
    ["Investido no ano", data.summary.invested_year.label, "good"],
    ["Pagas", data.summary.paid_expenses.label, ""]
  ];
  return (
    <div className="summary-grid">
      {items.map(([label, value, tone]) => (
        <article className="metric" data-tone={tone} key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </div>
  );
}

function OccurrenceTable({
  rows,
  compact = false,
  onToggle,
  onDelete
}: {
  rows: Occurrence[];
  compact?: boolean;
  onToggle: (id: number) => void;
  onDelete: (item: Occurrence) => void;
}) {
  return (
    <div className={`table-wrap ${compact ? "compact-table" : ""}`}>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            {!compact && <th>Tipo</th>}
            <th>Descricao</th>
            <th>Categoria</th>
            {!compact && <th>Parcela</th>}
            <th>Valor</th>
            <th>Status</th>
            {!compact && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={compact ? 5 : 8}>Nenhum lancamento para este periodo.</td>
            </tr>
          )}
          {rows.map((item) => (
            <tr
              key={item.id}
              onContextMenu={(event) => {
                event.preventDefault();
                onDelete(item);
              }}
            >
              <td>{item.dateLabel}</td>
              {!compact && <td>{item.type}</td>}
              <td>{item.name}</td>
              <td>{item.category}</td>
              {!compact && <td>{item.installment || "-"}</td>}
              <td className="amount">{item.amount}</td>
              <td><StatusPill status={item.status} /></td>
              {!compact && (
                <td onClick={(event) => event.stopPropagation()}>
                  <div className="row-actions">
                    <button className="button compact ghost" type="button" onClick={() => onToggle(item.id)}>Status</button>
                    <button className="button compact" type="button" onClick={() => onDelete(item)}>Remover</button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`pill ${status === "Pago" ? "paid" : "open"}`}>{status}</span>;
}

function ChartPanel({ title, eyebrow, children }: { title: string; eyebrow: string; children: ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function CategoryChart({ rows, large = false }: { rows: CategoryTotal[]; large?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const deps = useMemo(() => JSON.stringify(rows), [rows]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawCategoryChart(canvas, rows, large);
    const resize = () => drawCategoryChart(canvas, rows, large);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [deps, large]);
  return <canvas ref={canvasRef} height={large ? 360 : 280} />;
}

function YearChart({ rows, large = false }: { rows: YearlyTotal[]; large?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const deps = useMemo(() => JSON.stringify(rows), [rows]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawYearChart(canvas, rows, large);
    const resize = () => drawYearChart(canvas, rows, large);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [deps, large]);
  return <canvas ref={canvasRef} height={large ? 360 : 280} />;
}

function DeleteModal({
  item,
  onClose,
  onDelete
}: {
  item: Occurrence;
  onClose: () => void;
  onDelete: (scope: DeleteScope) => void;
}) {
  const options = deleteOptionsFor(item);
  return (
    <div className="modal-backdrop">
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <h3>Remover {item.name}</h3>
        <p>{options.copy}</p>
        <div className="modal-actions">
          {options.actions.map((action) => (
            <button
              className={`button ${action.primary ? "primary" : "ghost"}`}
              type="button"
              onClick={() => onDelete(action.scope)}
              key={action.scope}
            >
              {action.label}
            </button>
          ))}
          <button className="button ghost" type="button" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function deleteOptionsFor(item: Occurrence): { copy: string; actions: { scope: DeleteScope; label: string; primary?: boolean }[] } {
  if (item.type === "Fixa") {
    return {
      copy: "Escolha se a fixa sai so deste mes, deste mes em diante ou de todos os meses.",
      actions: [
        { scope: "single", label: "Somente este mes" },
        { scope: "from", label: "Deste mes em diante" },
        { scope: "all", label: "Todos os meses", primary: true }
      ]
    };
  }
  if (item.type === "Parcela") {
    return {
      copy: "Escolha se remove so esta parcela, desta parcela em diante ou todas as parcelas.",
      actions: [
        { scope: "single", label: "Somente esta parcela" },
        { scope: "from", label: "Desta parcela em diante" },
        { scope: "all", label: "Todas as parcelas", primary: true }
      ]
    };
  }
  return {
    copy: "Este lancamento sera removido.",
    actions: [{ scope: "all", label: "Remover", primary: true }]
  };
}

function NavButton({
  view,
  current,
  onClick,
  children
}: {
  view: View;
  current: View;
  onClick: (view: View) => void;
  children: ReactNode;
}) {
  return (
    <button className={`nav-item ${current === view ? "active" : ""}`} type="button" onClick={() => onClick(view)}>
      {children}
    </button>
  );
}

function toInputDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function inputDateToUserDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function drawCategoryChart(canvas: HTMLCanvasElement, rows: CategoryTotal[], large: boolean) {
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

function drawYearChart(canvas: HTMLCanvasElement, rows: YearlyTotal[], large: boolean) {
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

function setupCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas indisponivel.");
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, Math.abs(height) / 2, Math.abs(width) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawEmpty(ctx: CanvasRenderingContext2D, width: number, height: number, label: string) {
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "700 15px Segoe UI";
  ctx.textAlign = "center";
  ctx.fillText(label, width / 2, height / 2);
  ctx.textAlign = "left";
}
