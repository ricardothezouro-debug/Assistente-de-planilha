from __future__ import annotations

from datetime import date
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import posixpath
from urllib.parse import parse_qs, urlparse

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

STATIC_ROOT = Path(__file__).resolve().parent / "static"
PORT = 8765


class FinanceWebHandler(BaseHTTPRequestHandler):
    service = FinanceService(get_database_path())

    def do_GET(self) -> None:
        try:
            parsed = urlparse(self.path)
            if parsed.path == "/api/state":
                self.handle_state(parsed.query)
                return

            self.serve_static(parsed.path)
        except Exception as exc:
            self.send_error_json(str(exc), HTTPStatus.BAD_REQUEST)

    def do_POST(self) -> None:
        try:
            parsed = urlparse(self.path)
            routes = {
                "/api/entries": self.handle_create_entry,
                "/api/categories": self.handle_create_category,
                "/api/settings/initial-invested": self.handle_initial_invested,
            }

            if parsed.path in routes:
                routes[parsed.path]()
                return

            if parsed.path.startswith("/api/occurrences/") and parsed.path.endswith("/toggle"):
                occurrence_id = self.path_id(parsed.path, suffix="/toggle")
                self.handle_toggle(occurrence_id)
                return

            if parsed.path == "/api/delete":
                self.handle_delete()
                return

            self.send_error_json("Rota nao encontrada.", HTTPStatus.NOT_FOUND)
        except Exception as exc:
            self.send_error_json(str(exc), HTTPStatus.BAD_REQUEST)

    def log_message(self, format: str, *args: object) -> None:
        return

    def handle_state(self, query: str) -> None:
        params = parse_qs(query)
        today = date.today()
        year = int(params.get("year", [ACTIVE_YEAR])[0])
        month = int(params.get("month", [today.month if today.year == ACTIVE_YEAR else 1])[0])

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
            for row in self.service.list_occurrences(year, month)
        ]

        summary = self.service.monthly_summary(year, month)
        self.send_json(
            {
                "activeYear": ACTIVE_YEAR,
                "selectedYear": year,
                "selectedMonth": month,
                "today": today.isoformat(),
                "entryTypes": list(ENTRY_TYPES),
                "statuses": ["Auto", STATUS_PAID, STATUS_UNPAID],
                "monthNames": list(MONTH_NAMES),
                "categories": self.service.all_categories(),
                "occurrences": occurrences,
                "summary": serialize_money_map(summary),
                "categoryTotals": [
                    {
                        "category": item["category"],
                        "totalCents": item["total"],
                        "total": format_cents(int(item["total"])),
                    }
                    for item in self.service.monthly_category_totals(year, month)
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
                    for item in self.service.yearly_monthly_totals(year)
                ],
            }
        )

    def handle_create_entry(self) -> None:
        payload = self.read_json()
        entry_type = str(payload.get("type", "")).strip()
        status = str(payload.get("status", "Auto")).strip()
        installments = int(payload.get("installments") or 1)
        if entry_type != ENTRY_INSTALLMENT:
            installments = 1

        self.service.create_entry(
            entry_type=entry_type,
            name=str(payload.get("name", "")),
            amount_cents=parse_money_to_cents(str(payload.get("amount", ""))),
            category=str(payload.get("category", "")),
            start_date=parse_user_date(str(payload.get("date", ""))),
            installments=installments,
            status_override=None if status == "Auto" else status,
        )
        self.send_json({"ok": True}, HTTPStatus.CREATED)

    def handle_create_category(self) -> None:
        payload = self.read_json()
        category = self.service.add_category(str(payload.get("name", "")))
        self.send_json({"category": category}, HTTPStatus.CREATED)

    def handle_initial_invested(self) -> None:
        payload = self.read_json()
        self.service.update_initial_invested_cents(parse_money_to_cents(str(payload.get("amount", ""))))
        self.send_json({"ok": True})

    def handle_toggle(self, occurrence_id: int) -> None:
        status = self.service.toggle_occurrence_status(occurrence_id)
        self.send_json({"status": status})

    def handle_delete(self) -> None:
        payload = self.read_json()
        occurrence_id = int(payload.get("occurrenceId"))
        scope = str(payload.get("scope", "all"))

        if scope == "single":
            self.service.delete_single_occurrence(occurrence_id)
        elif scope == "from":
            self.service.delete_occurrences_from_selected_month(occurrence_id)
        else:
            self.service.delete_entry_by_occurrence(occurrence_id)
        self.send_json({"ok": True})

    def serve_static(self, raw_path: str) -> None:
        clean_path = posixpath.normpath(raw_path.lstrip("/"))
        if clean_path in ("", "."):
            clean_path = "index.html"

        target = (STATIC_ROOT / clean_path).resolve()
        if STATIC_ROOT.resolve() not in target.parents and target != STATIC_ROOT.resolve():
            self.send_error_json("Arquivo invalido.", HTTPStatus.BAD_REQUEST)
            return

        if not target.exists() or not target.is_file():
            target = STATIC_ROOT / "index.html"

        content = target.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type_for(target))
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def read_json(self) -> dict[str, object]:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        try:
            return json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise ValueError("JSON invalido.") from exc

    def path_id(self, path: str, suffix: str = "") -> int:
        value = path.removeprefix("/api/occurrences/")
        if suffix:
            value = value.removesuffix(suffix)
        return int(value.strip("/"))

    def send_json(self, payload: dict[str, object], status: HTTPStatus = HTTPStatus.OK) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def send_error_json(self, message: str, status: HTTPStatus = HTTPStatus.BAD_REQUEST) -> None:
        self.send_json({"error": message}, status)


def run(port: int = PORT) -> None:
    FinanceWebHandler.service.setup(seed=True)
    server = ThreadingHTTPServer(("127.0.0.1", port), FinanceWebHandler)
    print(f"Finly Assistente financeiro rodando em http://127.0.0.1:{port}")
    server.serve_forever()


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


def content_type_for(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".html":
        return "text/html; charset=utf-8"
    if suffix == ".css":
        return "text/css; charset=utf-8"
    if suffix == ".js":
        return "application/javascript; charset=utf-8"
    if suffix == ".svg":
        return "image/svg+xml"
    return "application/octet-stream"
