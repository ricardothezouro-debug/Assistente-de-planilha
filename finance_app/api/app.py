from __future__ import annotations

from datetime import date
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from finance_app.domain.constants import (
    ACTIVE_YEAR,
    ENTRY_INSTALLMENT,
    ENTRY_TYPES,
    MONTH_NAMES,
    STATUS_PAID,
    STATUS_UNPAID,
)
from finance_app.domain.dates import parse_user_date
from finance_app.domain.money import format_cents, parse_money_to_cents
from finance_app.services.finance_service import FinanceService
from finance_app.storage.database import get_database_path

service = FinanceService(get_database_path())
service.setup(seed=True)

app = FastAPI(title="Finly API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://tauri.localhost",
        "tauri://localhost",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class EntryCreate(BaseModel):
    type: str
    name: str
    amount: str
    category: str
    date: str
    installments: int = 1
    status: str = "Auto"


class CategoryCreate(BaseModel):
    name: str


class InitialInvestedUpdate(BaseModel):
    amount: str


class DeleteRequest(BaseModel):
    occurrence_id: int
    scope: Literal["all", "from", "single"] = "all"


@app.get("/api/state")
def get_state(year: int = ACTIVE_YEAR, month: int | None = None) -> dict[str, object]:
    today = date.today()
    selected_month = month or (today.month if today.year == ACTIVE_YEAR else 1)
    occurrences = [
        {
            "id": row["id"],
            "entryId": row["entry_id"],
            "type": row["type"],
            "name": row["name"],
            "category": row["category"],
            "dueDate": row["due_date"],
            "dateLabel": format_date_label(row["due_date"]),
            "amountCents": row["amount_cents"],
            "amount": format_cents(row["amount_cents"]),
            "installment": installment_label(row["installment_number"], row["installment_total"]),
            "status": row["status"],
        }
        for row in service.list_occurrences(year, selected_month)
    ]
    summary = service.monthly_summary(year, selected_month)

    return {
        "activeYear": ACTIVE_YEAR,
        "selectedYear": year,
        "selectedMonth": selected_month,
        "today": today.isoformat(),
        "entryTypes": list(ENTRY_TYPES),
        "statuses": ["Auto", STATUS_PAID, STATUS_UNPAID],
        "monthNames": list(MONTH_NAMES),
        "categories": service.all_categories(),
        "occurrences": occurrences,
        "summary": serialize_money_map(summary),
        "categoryTotals": [
            {
                "category": item["category"],
                "totalCents": item["total"],
                "total": format_cents(int(item["total"])),
            }
            for item in service.monthly_category_totals(year, selected_month)
        ],
        "yearlyTotals": [
            {
                "month": item["month"],
                "monthName": MONTH_NAMES[int(item["month"]) - 1],
                "incomeCents": item["income"],
                "expensesCents": item["expenses"],
                "investedCents": item["invested"],
                "balanceCents": item["balance"],
            }
            for item in service.yearly_monthly_totals(year)
        ],
    }


@app.post("/api/entries", status_code=201)
def create_entry(payload: EntryCreate) -> dict[str, bool]:
    try:
        installments = payload.installments if payload.type == ENTRY_INSTALLMENT else 1
        service.create_entry(
            entry_type=payload.type,
            name=payload.name,
            amount_cents=parse_money_to_cents(payload.amount),
            category=payload.category,
            start_date=parse_user_date(payload.date),
            installments=installments,
            status_override=None if payload.status == "Auto" else payload.status,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


@app.post("/api/categories", status_code=201)
def create_category(payload: CategoryCreate) -> dict[str, str]:
    try:
        category = service.add_category(payload.name)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"category": category}


@app.post("/api/settings/initial-invested")
def update_initial_invested(payload: InitialInvestedUpdate) -> dict[str, bool]:
    try:
        service.update_initial_invested_cents(parse_money_to_cents(payload.amount))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


@app.post("/api/occurrences/{occurrence_id}/toggle")
def toggle_occurrence(occurrence_id: int) -> dict[str, str]:
    try:
        status = service.toggle_occurrence_status(occurrence_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"status": status}


@app.post("/api/delete")
def delete_occurrence(payload: DeleteRequest) -> dict[str, bool]:
    try:
        if payload.scope == "single":
            service.delete_single_occurrence(payload.occurrence_id)
        elif payload.scope == "from":
            service.delete_occurrences_from_selected_month(payload.occurrence_id)
        else:
            service.delete_entry_by_occurrence(payload.occurrence_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


def serialize_money_map(values: dict[str, int]) -> dict[str, dict[str, int | str]]:
    return {
        key: {
            "cents": value,
            "label": format_cents(value),
        }
        for key, value in values.items()
    }


def format_date_label(value: str) -> str:
    parsed = date.fromisoformat(value)
    return parsed.strftime("%d/%m/%Y")


def installment_label(number: int | None, total: int | None) -> str:
    if number and total:
        return f"{number}/{total}"
    return ""
