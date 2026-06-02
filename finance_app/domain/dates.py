from calendar import monthrange
from datetime import date, datetime

from finance_app.domain.constants import ACTIVE_YEAR


def parse_user_date(value: str) -> date:
    text = value.strip()
    if not text:
        raise ValueError("Informe uma data.")

    formats = ("%d/%m/%Y", "%d/%m/%y", "%Y-%m-%d")
    for fmt in formats:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            pass

    try:
        parsed = datetime.strptime(text, "%d/%m").date()
        return date(ACTIVE_YEAR, parsed.month, parsed.day)
    except ValueError as exc:
        raise ValueError("Data invalida. Use dd/mm/aaaa ou dd/mm.") from exc


def add_months(original: date, months: int) -> date:
    month_index = original.month - 1 + months
    year = original.year + month_index // 12
    month = month_index % 12 + 1
    day = min(original.day, monthrange(year, month)[1])
    return date(year, month, day)


def month_start(year: int, month: int) -> date:
    return date(year, month, 1)


def month_end(year: int, month: int) -> date:
    return date(year, month, monthrange(year, month)[1])
