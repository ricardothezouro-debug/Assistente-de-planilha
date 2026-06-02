from __future__ import annotations

from datetime import date
import tkinter as tk
from tkinter import messagebox, simpledialog, ttk

from finance_app.domain.constants import (
    ACTIVE_YEAR,
    ENTRY_FIXED,
    ENTRY_INSTALLMENT,
    ENTRY_TYPES,
    ENTRY_VARIABLE,
    MONTH_NAMES,
    STATUS_PAID,
    STATUS_UNPAID,
)
from finance_app.domain.dates import parse_user_date
from finance_app.domain.money import format_cents, parse_money_to_cents
from finance_app.services.finance_service import FinanceService
from finance_app.ui.calendar_picker import CalendarPicker


class FinanceApp:
    def __init__(self, service: FinanceService) -> None:
        self.service = service
        today = date.today()

        self.root = tk.Tk()
        self.root.title("Controle financeiro")
        self.root.geometry("1160x720")
        self.root.minsize(980, 620)

        self.selected_year = tk.IntVar(value=ACTIVE_YEAR)
        self.selected_month = tk.IntVar(value=today.month if today.year == ACTIVE_YEAR else 1)

        self.type_var = tk.StringVar(value=ENTRY_VARIABLE)
        self.name_var = tk.StringVar()
        self.amount_var = tk.StringVar()
        self.category_var = tk.StringVar(value="Outros")
        self.date_var = tk.StringVar(value=today.strftime("%d/%m/%Y"))
        self.installments_var = tk.IntVar(value=2)
        self.status_var = tk.StringVar(value="Auto")

        self.summary_vars = {
            "income": tk.StringVar(),
            "expenses": tk.StringVar(),
            "paid_expenses": tk.StringVar(),
            "open_expenses": tk.StringVar(),
            "invested_month": tk.StringVar(),
            "initial_invested": tk.StringVar(),
            "balance": tk.StringVar(),
            "invested_year": tk.StringVar(),
        }

        self._configure_style()
        self._build()
        self._bind_events()
        self.refresh()

    def run(self) -> None:
        self.root.mainloop()

    def _configure_style(self) -> None:
        style = ttk.Style()
        if "vista" in style.theme_names():
            style.theme_use("vista")

        style.configure("Title.TLabel", font=("Segoe UI", 16, "bold"))
        style.configure("Section.TLabel", font=("Segoe UI", 11, "bold"))
        style.configure("Summary.TLabel", font=("Segoe UI", 10))
        style.configure("SummaryValue.TLabel", font=("Segoe UI", 10, "bold"))

    def _build(self) -> None:
        self.root.columnconfigure(0, weight=0)
        self.root.columnconfigure(1, weight=1)
        self.root.rowconfigure(1, weight=1)

        header = ttk.Frame(self.root, padding=(16, 14, 16, 8))
        header.grid(row=0, column=0, columnspan=2, sticky="ew")
        header.columnconfigure(1, weight=1)

        ttk.Label(header, text="Controle financeiro 2026", style="Title.TLabel").grid(
            row=0,
            column=0,
            sticky="w",
        )

        filters = ttk.Frame(header)
        filters.grid(row=0, column=2, sticky="e")

        ttk.Label(filters, text="Mes").grid(row=0, column=0, padx=(0, 6))
        self.month_combo = ttk.Combobox(
            filters,
            state="readonly",
            width=14,
            values=list(MONTH_NAMES),
        )
        self.month_combo.current(self.selected_month.get() - 1)
        self.month_combo.grid(row=0, column=1, padx=(0, 10))

        ttk.Label(filters, text="Ano").grid(row=0, column=2, padx=(0, 6))
        self.year_spin = ttk.Spinbox(
            filters,
            from_=2026,
            to=2035,
            textvariable=self.selected_year,
            width=8,
            command=self.refresh,
        )
        self.year_spin.grid(row=0, column=3, padx=(0, 10))

        ttk.Button(filters, text="Atualizar", command=self.refresh).grid(row=0, column=4)

        form = ttk.Frame(self.root, padding=(16, 8, 12, 16))
        form.grid(row=1, column=0, sticky="ns")
        form.columnconfigure(1, weight=1)

        ttk.Label(form, text="Novo lancamento", style="Section.TLabel").grid(
            row=0,
            column=0,
            columnspan=2,
            sticky="w",
            pady=(0, 12),
        )

        self._field(form, "Tipo", 1)
        self.type_combo = ttk.Combobox(
            form,
            state="readonly",
            values=list(ENTRY_TYPES),
            textvariable=self.type_var,
            width=24,
        )
        self.type_combo.grid(row=1, column=1, sticky="ew", pady=4)

        self._field(form, "Descricao", 2)
        ttk.Entry(form, textvariable=self.name_var, width=28).grid(row=2, column=1, sticky="ew", pady=4)

        self._field(form, "Valor", 3)
        ttk.Entry(form, textvariable=self.amount_var).grid(row=3, column=1, sticky="ew", pady=4)

        self._field(form, "Categoria", 4)
        category_frame = ttk.Frame(form)
        category_frame.grid(row=4, column=1, sticky="ew", pady=4)
        category_frame.columnconfigure(0, weight=1)
        self.category_combo = ttk.Combobox(
            category_frame,
            state="readonly",
            values=self.service.all_categories(),
            textvariable=self.category_var,
        )
        self.category_combo.grid(row=0, column=0, sticky="ew")
        ttk.Button(
            category_frame,
            text="Nova",
            command=self.add_category,
            width=7,
        ).grid(row=0, column=1, sticky="e", padx=(6, 0))

        self._field(form, "Data", 5)
        date_frame = ttk.Frame(form)
        date_frame.grid(row=5, column=1, sticky="ew", pady=4)
        date_frame.columnconfigure(0, weight=1)
        ttk.Entry(date_frame, textvariable=self.date_var).grid(row=0, column=0, sticky="ew")
        ttk.Button(
            date_frame,
            text="Calendario",
            command=self.open_calendar,
            width=10,
        ).grid(row=0, column=1, sticky="e", padx=(6, 0))

        self._field(form, "Parcelas", 6)
        self.installments_spin = ttk.Spinbox(
            form,
            from_=2,
            to=120,
            textvariable=self.installments_var,
            width=8,
        )
        self.installments_spin.grid(row=6, column=1, sticky="w", pady=4)

        self._field(form, "Status", 7)
        ttk.Combobox(
            form,
            state="readonly",
            values=("Auto", STATUS_PAID, STATUS_UNPAID),
            textvariable=self.status_var,
        ).grid(row=7, column=1, sticky="ew", pady=4)

        ttk.Button(form, text="Lancar", command=self.create_entry).grid(
            row=8,
            column=0,
            columnspan=2,
            sticky="ew",
            pady=(14, 6),
        )

        ttk.Button(form, text="Limpar", command=self.clear_form).grid(
            row=9,
            column=0,
            columnspan=2,
            sticky="ew",
        )

        ttk.Separator(form).grid(row=10, column=0, columnspan=2, sticky="ew", pady=16)

        ttk.Label(form, text="Resumo do mes", style="Section.TLabel").grid(
            row=11,
            column=0,
            columnspan=2,
            sticky="w",
            pady=(0, 8),
        )

        summary_rows = (
            ("Recebido", "income"),
            ("Despesas", "expenses"),
            ("Despesas pagas", "paid_expenses"),
            ("Em aberto", "open_expenses"),
            ("Investido no mes", "invested_month"),
            ("Investido inicial", "initial_invested"),
            ("Sobra", "balance"),
            ("Investido no ano", "invested_year"),
        )
        for index, (label, key) in enumerate(summary_rows, start=12):
            ttk.Label(form, text=label, style="Summary.TLabel").grid(row=index, column=0, sticky="w", pady=2)
            ttk.Label(form, textvariable=self.summary_vars[key], style="SummaryValue.TLabel").grid(
                row=index,
                column=1,
                sticky="e",
                pady=2,
            )

        ttk.Button(
            form,
            text="Alterar investido inicial",
            command=self.edit_initial_invested,
        ).grid(row=20, column=0, columnspan=2, sticky="ew", pady=(10, 0))

        main = ttk.Frame(self.root, padding=(4, 8, 16, 16))
        main.grid(row=1, column=1, sticky="nsew")
        main.rowconfigure(1, weight=1)
        main.columnconfigure(0, weight=1)

        notebook = ttk.Notebook(main)
        notebook.grid(row=0, column=0, sticky="nsew")
        main.rowconfigure(0, weight=1)

        list_tab = ttk.Frame(notebook, padding=(4, 8, 4, 4))
        graph_tab = ttk.Frame(notebook, padding=(10, 10, 10, 10))
        notebook.add(list_tab, text="Lancamentos")
        notebook.add(graph_tab, text="Graficos")

        list_tab.rowconfigure(1, weight=1)
        list_tab.columnconfigure(0, weight=1)
        graph_tab.rowconfigure(1, weight=1)
        graph_tab.rowconfigure(3, weight=1)
        graph_tab.columnconfigure(0, weight=1)

        actions = ttk.Frame(list_tab)
        actions.grid(row=0, column=0, sticky="ew", pady=(0, 8))
        actions.columnconfigure(0, weight=1)

        ttk.Label(actions, text="Lancamentos do mes", style="Section.TLabel").grid(row=0, column=0, sticky="w")
        ttk.Button(actions, text="Alternar Pago/Nao pago", command=self.toggle_selected).grid(
            row=0,
            column=1,
            sticky="e",
        )

        columns = ("date", "type", "name", "category", "amount", "installment", "status")
        self.tree = ttk.Treeview(list_tab, columns=columns, show="headings", selectmode="browse")
        self.tree.grid(row=1, column=0, sticky="nsew")

        headings = {
            "date": ("Data", 90),
            "type": ("Tipo", 95),
            "name": ("Descricao", 260),
            "category": ("Categoria", 120),
            "amount": ("Valor", 100),
            "installment": ("Parcela", 80),
            "status": ("Status", 90),
        }
        for column, (label, width) in headings.items():
            self.tree.heading(column, text=label)
            self.tree.column(column, width=width, anchor="w")
        self.tree.column("amount", anchor="e")
        self.tree.column("installment", anchor="center")
        self.tree.column("status", anchor="center")

        scrollbar = ttk.Scrollbar(list_tab, orient="vertical", command=self.tree.yview)
        scrollbar.grid(row=1, column=1, sticky="ns")
        self.tree.configure(yscrollcommand=scrollbar.set)

        ttk.Label(graph_tab, text="Gastos por categoria no mes", style="Section.TLabel").grid(
            row=0,
            column=0,
            sticky="w",
            pady=(0, 6),
        )
        self.category_chart = tk.Canvas(graph_tab, bg="#151922", highlightthickness=0, height=260)
        self.category_chart.grid(row=1, column=0, sticky="nsew", pady=(0, 12))

        ttk.Label(graph_tab, text="Visao anual", style="Section.TLabel").grid(
            row=2,
            column=0,
            sticky="w",
            pady=(0, 6),
        )
        self.year_chart = tk.Canvas(graph_tab, bg="#151922", highlightthickness=0, height=260)
        self.year_chart.grid(row=3, column=0, sticky="nsew")

        self.context_menu = tk.Menu(self.root, tearoff=False)
        self.context_menu.add_command(label="Remover", command=self.delete_selected)

    def _field(self, parent: ttk.Frame, label: str, row: int) -> None:
        ttk.Label(parent, text=label).grid(row=row, column=0, sticky="w", padx=(0, 10), pady=4)

    def _bind_events(self) -> None:
        self.type_combo.bind("<<ComboboxSelected>>", lambda _event: self.update_installment_state())
        self.month_combo.bind("<<ComboboxSelected>>", lambda _event: self.on_month_changed())
        self.tree.bind("<Double-1>", lambda _event: self.toggle_selected())
        self.tree.bind("<Button-3>", self.open_context_menu)
        self.category_chart.bind("<Configure>", lambda _event: self.draw_graphs())
        self.year_chart.bind("<Configure>", lambda _event: self.draw_graphs())
        self.update_installment_state()

    def on_month_changed(self) -> None:
        self.selected_month.set(self.month_combo.current() + 1)
        self.refresh()

    def update_installment_state(self) -> None:
        state = "normal" if self.type_var.get() == ENTRY_INSTALLMENT else "disabled"
        self.installments_spin.configure(state=state)

    def create_entry(self) -> None:
        try:
            entry_type = self.type_var.get()
            installments = int(self.installments_var.get()) if entry_type == ENTRY_INSTALLMENT else 1
            status_override = None if self.status_var.get() == "Auto" else self.status_var.get()
            self.service.create_entry(
                entry_type=entry_type,
                name=self.name_var.get(),
                amount_cents=parse_money_to_cents(self.amount_var.get()),
                category=self.category_var.get(),
                start_date=parse_user_date(self.date_var.get()),
                installments=installments,
                status_override=status_override,
            )
        except Exception as exc:
            messagebox.showerror("Nao foi possivel lancar", str(exc))
            return

        self.clear_form(keep_date=True)
        self.refresh()

    def edit_initial_invested(self) -> None:
        current = format_cents(self.service.initial_invested_cents())
        value = simpledialog.askstring(
            "Investido inicial",
            "Valor investido inicial do ano:",
            initialvalue=current,
            parent=self.root,
        )
        if value is None:
            return

        try:
            self.service.update_initial_invested_cents(parse_money_to_cents(value))
        except Exception as exc:
            messagebox.showerror("Nao foi possivel alterar", str(exc))
            return

        self.refresh()

    def add_category(self) -> None:
        value = simpledialog.askstring(
            "Nova categoria",
            "Nome da categoria:",
            parent=self.root,
        )
        if value is None:
            return

        try:
            category = self.service.add_category(value)
        except Exception as exc:
            messagebox.showerror("Nao foi possivel criar", str(exc))
            return

        self.category_combo.configure(values=self.service.all_categories())
        self.category_var.set(category)

    def open_calendar(self) -> None:
        CalendarPicker(self.root, self.set_date_from_calendar)

    def set_date_from_calendar(self, value: date) -> None:
        self.date_var.set(value.strftime("%d/%m/%Y"))

    def clear_form(self, keep_date: bool = False) -> None:
        self.type_var.set(ENTRY_VARIABLE)
        self.name_var.set("")
        self.amount_var.set("")
        self.category_var.set("Outros")
        if not keep_date:
            self.date_var.set(date.today().strftime("%d/%m/%Y"))
        self.installments_var.set(2)
        self.status_var.set("Auto")
        self.update_installment_state()

    def refresh(self) -> None:
        try:
            year = int(self.selected_year.get())
        except tk.TclError:
            year = ACTIVE_YEAR
            self.selected_year.set(year)

        month = self.selected_month.get()
        self.tree.delete(*self.tree.get_children())
        rows = self.service.list_occurrences(year, month)
        for row in rows:
            installment = ""
            if row["installment_number"] and row["installment_total"]:
                installment = f"{row['installment_number']}/{row['installment_total']}"

            self.tree.insert(
                "",
                "end",
                iid=str(row["id"]),
                values=(
                    format_date_for_display(row["due_date"]),
                    row["type"],
                    row["name"],
                    row["category"],
                    format_cents(row["amount_cents"]),
                    installment,
                    row["status"],
                ),
            )

        summary = self.service.monthly_summary(year, month)
        for key, value in summary.items():
            self.summary_vars[key].set(format_cents(value))
        self.draw_graphs()

    def draw_graphs(self) -> None:
        if not hasattr(self, "category_chart") or not hasattr(self, "year_chart"):
            return

        try:
            year = int(self.selected_year.get())
        except tk.TclError:
            year = ACTIVE_YEAR
        month = self.selected_month.get()

        self.draw_category_chart(year, month)
        self.draw_year_chart(year)

    def draw_category_chart(self, year: int, month: int) -> None:
        canvas = self.category_chart
        canvas.delete("all")
        width = max(canvas.winfo_width(), 520)
        height = max(canvas.winfo_height(), 240)
        canvas.create_rectangle(0, 0, width, height, fill="#151922", outline="")

        rows = self.service.monthly_category_totals(year, month)
        if not rows:
            canvas.create_text(
                width // 2,
                height // 2,
                text="Sem despesas neste mes",
                fill="#cbd5e1",
                font=("Segoe UI", 12, "bold"),
            )
            return

        max_total = max(int(row["total"]) for row in rows)
        colors = ("#38bdf8", "#a78bfa", "#34d399", "#f59e0b", "#fb7185", "#22c55e", "#e879f9", "#60a5fa")
        top = 24
        row_height = max(26, min(42, (height - 44) // max(len(rows), 1)))
        label_width = 150
        value_width = 110
        bar_left = label_width + 20
        bar_right = width - value_width - 24
        bar_max_width = max(80, bar_right - bar_left)

        for index, row in enumerate(rows):
            y = top + index * row_height
            total = int(row["total"])
            bar_width = int((total / max_total) * bar_max_width)
            color = colors[index % len(colors)]
            canvas.create_text(
                16,
                y + 10,
                text=str(row["category"]),
                fill="#e5e7eb",
                anchor="w",
                font=("Segoe UI", 10, "bold"),
            )
            canvas.create_rectangle(
                bar_left,
                y,
                bar_left + bar_width,
                y + 20,
                fill=color,
                outline="",
            )
            canvas.create_text(
                width - 16,
                y + 10,
                text=format_cents(total),
                fill="#e5e7eb",
                anchor="e",
                font=("Segoe UI", 10),
            )

    def draw_year_chart(self, year: int) -> None:
        canvas = self.year_chart
        canvas.delete("all")
        width = max(canvas.winfo_width(), 520)
        height = max(canvas.winfo_height(), 240)
        canvas.create_rectangle(0, 0, width, height, fill="#151922", outline="")

        rows = self.service.yearly_monthly_totals(year)
        max_total = max(
            [1]
            + [int(row["income"]) for row in rows]
            + [int(row["expenses"]) for row in rows]
        )
        chart_left = 42
        chart_right = width - 18
        chart_top = 22
        chart_bottom = height - 44
        chart_height = max(80, chart_bottom - chart_top)
        month_width = max(28, (chart_right - chart_left) // 12)
        bar_width = max(6, min(14, month_width // 3))

        canvas.create_text(
            chart_left,
            10,
            text="Recebido",
            fill="#34d399",
            anchor="w",
            font=("Segoe UI", 9, "bold"),
        )
        canvas.create_text(
            chart_left + 86,
            10,
            text="Despesas",
            fill="#fb7185",
            anchor="w",
            font=("Segoe UI", 9, "bold"),
        )

        canvas.create_line(chart_left, chart_bottom, chart_right, chart_bottom, fill="#334155")
        for row in rows:
            month = int(row["month"])
            x = chart_left + (month - 1) * month_width + month_width // 2
            income_height = int((int(row["income"]) / max_total) * chart_height)
            expense_height = int((int(row["expenses"]) / max_total) * chart_height)
            canvas.create_rectangle(
                x - bar_width - 1,
                chart_bottom - income_height,
                x - 1,
                chart_bottom,
                fill="#34d399",
                outline="",
            )
            canvas.create_rectangle(
                x + 1,
                chart_bottom - expense_height,
                x + bar_width + 1,
                chart_bottom,
                fill="#fb7185",
                outline="",
            )
            canvas.create_text(
                x,
                chart_bottom + 14,
                text=MONTH_NAMES[month - 1][:3],
                fill="#cbd5e1",
                font=("Segoe UI", 8),
            )

    def toggle_selected(self) -> None:
        selection = self.tree.selection()
        if not selection:
            messagebox.showinfo("Selecione um lancamento", "Escolha um item da lista primeiro.")
            return

        occurrence_id = int(selection[0])
        try:
            self.service.toggle_occurrence_status(occurrence_id)
        except Exception as exc:
            messagebox.showerror("Nao foi possivel atualizar", str(exc))
            return
        self.refresh()

    def open_context_menu(self, event: tk.Event) -> None:
        row_id = self.tree.identify_row(event.y)
        if not row_id:
            return

        self.tree.selection_set(row_id)
        self.tree.focus(row_id)
        self.context_menu.tk_popup(event.x_root, event.y_root)

    def delete_selected(self) -> None:
        selection = self.tree.selection()
        if not selection:
            messagebox.showinfo("Selecione um lancamento", "Escolha um item da lista primeiro.")
            return

        values = self.tree.item(selection[0], "values")
        entry_type = values[1] if len(values) > 1 else ""
        name = values[2] if len(values) > 2 else "este lancamento"

        if entry_type == ENTRY_FIXED:
            scope = self.ask_delete_scope(
                title="Remover fixa",
                prompt=f"Como remover {name}?",
                all_text="Todos os meses",
                from_text="Deste mes em diante",
                single_text="Somente este mes",
            )
            if scope is None:
                return

            try:
                if scope == "all":
                    self.service.delete_entry_by_occurrence(int(selection[0]))
                elif scope == "from":
                    self.service.delete_occurrences_from_selected_month(int(selection[0]))
                else:
                    self.service.delete_single_occurrence(int(selection[0]))
            except Exception as exc:
                messagebox.showerror("Nao foi possivel remover", str(exc))
                return

            self.refresh()
            return

        if entry_type == ENTRY_INSTALLMENT:
            scope = self.ask_delete_scope(
                title="Remover parcela",
                prompt=f"Como remover {name}?",
                all_text="Todas as parcelas",
                from_text="Desta parcela em diante",
                single_text="Somente esta parcela",
            )
            if scope is None:
                return

            try:
                if scope == "all":
                    self.service.delete_entry_by_occurrence(int(selection[0]))
                elif scope == "from":
                    self.service.delete_occurrences_from_selected_month(int(selection[0]))
                else:
                    self.service.delete_single_occurrence(int(selection[0]))
            except Exception as exc:
                messagebox.showerror("Nao foi possivel remover", str(exc))
                return

            self.refresh()
            return

        confirmed = messagebox.askyesno(
            "Remover lancamento",
            f"Remover {name}?",
        )
        if not confirmed:
            return

        try:
            self.service.delete_entry_by_occurrence(int(selection[0]))
        except Exception as exc:
            messagebox.showerror("Nao foi possivel remover", str(exc))
            return

        self.refresh()

    def ask_delete_scope(
        self,
        title: str,
        prompt: str,
        all_text: str,
        from_text: str,
        single_text: str,
    ) -> str | None:
        result: list[str | None] = [None]
        dialog = tk.Toplevel(self.root)
        dialog.title(title)
        dialog.resizable(False, False)
        dialog.transient(self.root)
        dialog.grab_set()

        frame = ttk.Frame(dialog, padding=14)
        frame.grid(row=0, column=0, sticky="nsew")
        ttk.Label(
            frame,
            text=prompt,
            style="Section.TLabel",
        ).grid(row=0, column=0, sticky="w", pady=(0, 10))

        def choose(value: str | None) -> None:
            result[0] = value
            dialog.destroy()

        ttk.Button(frame, text=all_text, command=lambda: choose("all")).grid(
            row=1,
            column=0,
            sticky="ew",
            pady=2,
        )
        ttk.Button(frame, text=from_text, command=lambda: choose("from")).grid(
            row=2,
            column=0,
            sticky="ew",
            pady=2,
        )
        ttk.Button(frame, text=single_text, command=lambda: choose("single")).grid(
            row=3,
            column=0,
            sticky="ew",
            pady=2,
        )
        ttk.Button(frame, text="Cancelar", command=lambda: choose(None)).grid(
            row=4,
            column=0,
            sticky="ew",
            pady=(10, 0),
        )

        dialog.bind("<Escape>", lambda _event: choose(None))
        dialog.wait_window()
        return result[0]


def format_date_for_display(value: str) -> str:
    parsed = date.fromisoformat(value)
    return parsed.strftime("%d/%m/%Y")
