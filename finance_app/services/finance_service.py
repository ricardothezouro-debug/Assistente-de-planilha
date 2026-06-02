from __future__ import annotations

from calendar import monthrange
from contextlib import contextmanager
from datetime import date
from pathlib import Path
import sqlite3
from typing import Any, Iterator

from finance_app.domain.constants import (
    ACTIVE_YEAR,
    ENTRY_FIXED,
    ENTRY_INCOME,
    ENTRY_INSTALLMENT,
    ENTRY_TYPES,
    ENTRY_VARIABLE,
    INITIAL_INVESTED_CENTS,
    PAID_CUTOFF,
    STATUS_PAID,
    STATUS_UNPAID,
)
from finance_app.domain.dates import add_months
from finance_app.domain.money import split_amount
from finance_app.storage.database import connect, initialize_database
from finance_app.storage.seed import INITIAL_ENTRIES


class FinanceService:
    def __init__(self, db_path: Path | str | None = None) -> None:
        self.db_path = Path(db_path) if db_path else None

    def setup(self, seed: bool = True) -> None:
        with self._connection() as conn:
            initialize_database(conn)
            if seed:
                self.seed_initial_data(conn)

    def _connect(self) -> sqlite3.Connection:
        return connect(self.db_path)

    @contextmanager
    def _connection(self) -> Iterator[sqlite3.Connection]:
        conn = self._connect()
        try:
            yield conn
        finally:
            conn.close()

    def seed_initial_data(self, conn: sqlite3.Connection | None = None) -> None:
        owns_connection = conn is None
        if conn is None:
            conn = self._connect()

        try:
            seeded = self.get_setting("seeded_initial_data", conn=conn)
            if seeded == "1":
                return

            for entry in INITIAL_ENTRIES:
                self.create_entry(
                    entry_type=entry.type,
                    name=entry.name,
                    amount_cents=entry.amount_cents,
                    category=entry.category,
                    start_date=entry.start_date,
                    installments=entry.installments,
                    notes=entry.notes,
                    conn=conn,
                )

            self.set_setting("seeded_initial_data", "1", conn=conn)
            conn.commit()
        finally:
            if owns_connection:
                conn.close()

    def get_setting(self, key: str, conn: sqlite3.Connection | None = None) -> str | None:
        owns_connection = conn is None
        if conn is None:
            conn = self._connect()

        try:
            row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
            return row["value"] if row else None
        finally:
            if owns_connection:
                conn.close()

    def set_setting(
        self,
        key: str,
        value: str,
        conn: sqlite3.Connection | None = None,
    ) -> None:
        owns_connection = conn is None
        if conn is None:
            conn = self._connect()

        try:
            conn.execute(
                """
                INSERT INTO settings(key, value)
                VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
                """,
                (key, value),
            )
            if owns_connection:
                conn.commit()
        finally:
            if owns_connection:
                conn.close()

    def initial_invested_cents(self) -> int:
        value = self.get_setting("initial_invested_cents")
        return int(value) if value is not None else INITIAL_INVESTED_CENTS

    def update_initial_invested_cents(self, amount_cents: int) -> None:
        if amount_cents < 0:
            raise ValueError("O valor investido inicial nao pode ser negativo.")
        self.set_setting("initial_invested_cents", str(amount_cents))

    def category_id(self, category: str, conn: sqlite3.Connection) -> int:
        row = conn.execute("SELECT id FROM categories WHERE name = ?", (category,)).fetchone()
        if not row:
            raise ValueError(f"Categoria invalida: {category}")
        return int(row["id"])

    def add_category(self, name: str) -> str:
        category_name = " ".join(name.strip().split())
        if not category_name:
            raise ValueError("Informe o nome da categoria.")

        with self._connection() as conn:
            existing = conn.execute(
                "SELECT name FROM categories WHERE lower(name) = lower(?)",
                (category_name,),
            ).fetchone()
            if existing:
                return str(existing["name"])

            conn.execute("INSERT INTO categories(name) VALUES (?)", (category_name,))
            conn.commit()
            return category_name

    def create_entry(
        self,
        entry_type: str,
        name: str,
        amount_cents: int,
        category: str,
        start_date: date,
        installments: int = 1,
        notes: str = "",
        status_override: str | None = None,
        conn: sqlite3.Connection | None = None,
    ) -> int:
        if entry_type not in ENTRY_TYPES:
            raise ValueError(f"Tipo invalido: {entry_type}")
        if not name.strip():
            raise ValueError("Informe uma descricao.")
        if amount_cents <= 0:
            raise ValueError("O valor deve ser maior que zero.")
        if entry_type == ENTRY_INSTALLMENT and installments <= 1:
            raise ValueError("Parcelas precisam ter pelo menos 2 vezes.")
        if entry_type != ENTRY_INSTALLMENT:
            installments = 1

        owns_connection = conn is None
        if conn is None:
            conn = self._connect()

        try:
            category_id = self.category_id(category, conn)
            cursor = conn.execute(
                """
                INSERT INTO entries(
                    type, name, total_amount_cents, category_id,
                    start_date, installments, notes
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    entry_type,
                    name.strip(),
                    amount_cents,
                    category_id,
                    start_date.isoformat(),
                    installments,
                    notes,
                ),
            )
            entry_id = int(cursor.lastrowid)
            self._create_occurrences(
                conn=conn,
                entry_id=entry_id,
                entry_type=entry_type,
                name=name.strip(),
                amount_cents=amount_cents,
                category_id=category_id,
                start_date=start_date,
                installments=installments,
                status_override=status_override,
            )

            if owns_connection:
                conn.commit()
            return entry_id
        except Exception:
            if owns_connection:
                conn.rollback()
            raise
        finally:
            if owns_connection:
                conn.close()

    def _create_occurrences(
        self,
        conn: sqlite3.Connection,
        entry_id: int,
        entry_type: str,
        name: str,
        amount_cents: int,
        category_id: int,
        start_date: date,
        installments: int,
        status_override: str | None,
    ) -> None:
        if entry_type == ENTRY_FIXED:
            if start_date.year > ACTIVE_YEAR:
                return
            start_month = start_date.month if start_date.year == ACTIVE_YEAR else 1
            for month in range(start_month, 13):
                day = min(start_date.day, monthrange(ACTIVE_YEAR, month)[1])
                due_date = date(ACTIVE_YEAR, month, day)
                self._insert_occurrence(
                    conn,
                    entry_id,
                    category_id,
                    entry_type,
                    name,
                    due_date,
                    amount_cents,
                    None,
                    None,
                    status_override,
                )
            return

        if entry_type == ENTRY_INSTALLMENT:
            amounts = split_amount(amount_cents, installments)
            for index, installment_amount in enumerate(amounts, start=1):
                due_date = add_months(start_date, index - 1)
                self._insert_occurrence(
                    conn,
                    entry_id,
                    category_id,
                    entry_type,
                    name,
                    due_date,
                    installment_amount,
                    index,
                    installments,
                    status_override,
                )
            return

        if entry_type in (ENTRY_VARIABLE, ENTRY_INCOME):
            self._insert_occurrence(
                conn,
                entry_id,
                category_id,
                entry_type,
                name,
                start_date,
                amount_cents,
                None,
                None,
                status_override,
            )
            return

        raise ValueError(f"Tipo invalido: {entry_type}")

    def _insert_occurrence(
        self,
        conn: sqlite3.Connection,
        entry_id: int,
        category_id: int,
        entry_type: str,
        name: str,
        due_date: date,
        amount_cents: int,
        installment_number: int | None,
        installment_total: int | None,
        status_override: str | None,
    ) -> None:
        status = status_override or default_status_for_date(due_date)
        if status not in (STATUS_PAID, STATUS_UNPAID):
            raise ValueError(f"Status invalido: {status}")

        conn.execute(
            """
            INSERT OR IGNORE INTO occurrences(
                entry_id, category_id, type, name, due_date, year, month,
                amount_cents, installment_number, installment_total, status,
                paid_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                entry_id,
                category_id,
                entry_type,
                name,
                due_date.isoformat(),
                due_date.year,
                due_date.month,
                amount_cents,
                installment_number,
                installment_total,
                status,
                date.today().isoformat() if status == STATUS_PAID else None,
            ),
        )

    def list_occurrences(self, year: int, month: int) -> list[sqlite3.Row]:
        with self._connection() as conn:
            return list(
                conn.execute(
                    """
                    SELECT
                        o.id,
                        o.entry_id,
                        o.type,
                        o.name,
                        c.name AS category,
                        o.due_date,
                        o.amount_cents,
                        o.installment_number,
                        o.installment_total,
                        o.status
                    FROM occurrences o
                    JOIN categories c ON c.id = o.category_id
                    WHERE o.year = ? AND o.month = ?
                    ORDER BY o.due_date, o.id
                    """,
                    (year, month),
                )
            )

    def toggle_occurrence_status(self, occurrence_id: int) -> str:
        with self._connection() as conn:
            row = conn.execute(
                "SELECT status FROM occurrences WHERE id = ?",
                (occurrence_id,),
            ).fetchone()
            if not row:
                raise ValueError("Lancamento nao encontrado.")

            new_status = STATUS_UNPAID if row["status"] == STATUS_PAID else STATUS_PAID
            conn.execute(
                """
                UPDATE occurrences
                SET status = ?, paid_at = ?
                WHERE id = ?
                """,
                (
                    new_status,
                    date.today().isoformat() if new_status == STATUS_PAID else None,
                    occurrence_id,
                ),
            )
            conn.commit()
            return new_status

    def delete_entry_by_occurrence(self, occurrence_id: int) -> str:
        with self._connection() as conn:
            row = conn.execute(
                """
                SELECT entry_id, name
                FROM occurrences
                WHERE id = ?
                """,
                (occurrence_id,),
            ).fetchone()
            if not row:
                raise ValueError("Lancamento nao encontrado.")

            conn.execute("DELETE FROM entries WHERE id = ?", (row["entry_id"],))
            conn.commit()
            return str(row["name"])

    def delete_single_occurrence(self, occurrence_id: int) -> str:
        with self._connection() as conn:
            row = conn.execute(
                "SELECT name FROM occurrences WHERE id = ?",
                (occurrence_id,),
            ).fetchone()
            if not row:
                raise ValueError("Lancamento nao encontrado.")

            conn.execute("DELETE FROM occurrences WHERE id = ?", (occurrence_id,))
            conn.commit()
            return str(row["name"])

    def delete_occurrences_from_selected_month(self, occurrence_id: int) -> str:
        with self._connection() as conn:
            row = conn.execute(
                """
                SELECT entry_id, name, due_date
                FROM occurrences
                WHERE id = ?
                """,
                (occurrence_id,),
            ).fetchone()
            if not row:
                raise ValueError("Lancamento nao encontrado.")

            conn.execute(
                """
                DELETE FROM occurrences
                WHERE entry_id = ?
                    AND due_date >= ?
                """,
                (row["entry_id"], row["due_date"]),
            )
            conn.commit()
            return str(row["name"])

    def monthly_summary(self, year: int, month: int) -> dict[str, int]:
        rows = self.list_occurrences(year, month)
        income = sum(row["amount_cents"] for row in rows if row["type"] == ENTRY_INCOME)
        expenses = sum(row["amount_cents"] for row in rows if row["type"] != ENTRY_INCOME)
        paid_expenses = sum(
            row["amount_cents"]
            for row in rows
            if row["type"] != ENTRY_INCOME and row["status"] == STATUS_PAID
        )
        open_expenses = sum(
            row["amount_cents"]
            for row in rows
            if row["type"] != ENTRY_INCOME and row["status"] == STATUS_UNPAID
        )
        invested_month = sum(
            row["amount_cents"]
            for row in rows
            if row["type"] != ENTRY_INCOME and row["category"] == "Investimento"
        )

        return {
            "initial_invested": self.initial_invested_cents() if year == ACTIVE_YEAR else 0,
            "income": income,
            "expenses": expenses,
            "paid_expenses": paid_expenses,
            "open_expenses": open_expenses,
            "invested_month": invested_month,
            "balance": income - expenses,
            "invested_year": self.year_invested_total(year),
        }

    def monthly_category_totals(self, year: int, month: int) -> list[dict[str, int | str]]:
        with self._connection() as conn:
            rows = conn.execute(
                """
                SELECT c.name AS category, COALESCE(SUM(o.amount_cents), 0) AS total
                FROM occurrences o
                JOIN categories c ON c.id = o.category_id
                WHERE o.year = ?
                    AND o.month = ?
                    AND o.type != ?
                GROUP BY c.name
                HAVING total > 0
                ORDER BY total DESC, c.name
                """,
                (year, month, ENTRY_INCOME),
            ).fetchall()
            return [
                {"category": str(row["category"]), "total": int(row["total"])}
                for row in rows
            ]

    def yearly_monthly_totals(self, year: int) -> list[dict[str, int]]:
        result = []
        for month in range(1, 13):
            rows = self.list_occurrences(year, month)
            income = sum(row["amount_cents"] for row in rows if row["type"] == ENTRY_INCOME)
            expenses = sum(row["amount_cents"] for row in rows if row["type"] != ENTRY_INCOME)
            invested = sum(
                row["amount_cents"]
                for row in rows
                if row["type"] != ENTRY_INCOME and row["category"] == "Investimento"
            )
            result.append(
                {
                    "month": month,
                    "income": income,
                    "expenses": expenses,
                    "invested": invested,
                    "balance": income - expenses,
                }
            )
        return result

    def year_invested_total(self, year: int) -> int:
        initial = self.initial_invested_cents() if year == ACTIVE_YEAR else 0
        with self._connection() as conn:
            row = conn.execute(
                """
                SELECT COALESCE(SUM(o.amount_cents), 0) AS total
                FROM occurrences o
                JOIN categories c ON c.id = o.category_id
                WHERE o.year = ?
                    AND c.name = 'Investimento'
                    AND o.type != ?
                    AND o.status = ?
                """,
                (year, ENTRY_INCOME, STATUS_PAID),
            ).fetchone()
            return initial + int(row["total"])

    def all_categories(self) -> list[str]:
        with self._connection() as conn:
            return [row["name"] for row in conn.execute("SELECT name FROM categories ORDER BY id")]


def default_status_for_date(due_date: date) -> str:
    return STATUS_PAID if due_date <= PAID_CUTOFF else STATUS_UNPAID


def row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {key: row[key] for key in row.keys()}
