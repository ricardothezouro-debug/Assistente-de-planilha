from pathlib import Path
import os
import sqlite3
import sys

from finance_app.domain.constants import (
    ACTIVE_YEAR,
    CATEGORIES,
    INITIAL_INVESTED_CENTS,
)


def get_project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def get_database_path() -> Path:
    configured_path = os.getenv("FINANCEIRO_DB_PATH")
    if configured_path:
        return Path(configured_path)

    if getattr(sys, "frozen", False):
        base = os.getenv("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
        return Path(base) / "Financeiro" / "data" / "financeiro.db"

    return get_project_root() / "data" / "financeiro.db"


def connect(db_path: Path | str | None = None) -> sqlite3.Connection:
    path = Path(db_path) if db_path else get_database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def initialize_database(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            name TEXT NOT NULL,
            total_amount_cents INTEGER NOT NULL,
            category_id INTEGER NOT NULL,
            start_date TEXT NOT NULL,
            installments INTEGER NOT NULL DEFAULT 1,
            notes TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories(id)
        );

        CREATE TABLE IF NOT EXISTS occurrences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entry_id INTEGER NOT NULL,
            category_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            name TEXT NOT NULL,
            due_date TEXT NOT NULL,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            amount_cents INTEGER NOT NULL,
            installment_number INTEGER,
            installment_total INTEGER,
            status TEXT NOT NULL,
            paid_at TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
            FOREIGN KEY (category_id) REFERENCES categories(id),
            UNIQUE (entry_id, due_date, installment_number)
        );

        CREATE INDEX IF NOT EXISTS idx_occurrences_year_month
            ON occurrences(year, month);

        CREATE INDEX IF NOT EXISTS idx_occurrences_status
            ON occurrences(status);
        """
    )

    for category in CATEGORIES:
        conn.execute(
            "INSERT OR IGNORE INTO categories(name) VALUES (?)",
            (category,),
        )

    conn.execute(
        "INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)",
        ("active_year", str(ACTIVE_YEAR)),
    )
    conn.execute(
        "INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)",
        ("initial_invested_cents", str(INITIAL_INVESTED_CENTS)),
    )
    conn.commit()
