from dataclasses import dataclass
from datetime import date

from finance_app.domain.constants import (
    ENTRY_FIXED,
    ENTRY_INSTALLMENT,
)


@dataclass(frozen=True)
class SeedEntry:
    type: str
    name: str
    amount_cents: int
    category: str
    start_date: date
    installments: int = 1
    notes: str = "Migrado do Notion"


INITIAL_ENTRIES = (
    SeedEntry(ENTRY_FIXED, "Vivo", 4_300, "Assinatura", date(2026, 2, 1)),
    SeedEntry(ENTRY_FIXED, "Mei", 8_090, "Outros", date(2026, 2, 1)),
    SeedEntry(ENTRY_FIXED, "YouTube Premium", 2_690, "Assinatura", date(2026, 2, 1)),
    SeedEntry(ENTRY_FIXED, "Crunchyroll", 1_999, "Assinatura", date(2026, 2, 1)),
    SeedEntry(ENTRY_FIXED, "Google One", 999, "Assinatura", date(2026, 2, 1)),
    SeedEntry(ENTRY_FIXED, "Cap cut", 3_290, "Assinatura", date(2026, 2, 1)),
    SeedEntry(ENTRY_INSTALLMENT, "Celular", 323_100, "Outros", date(2026, 1, 1), 9),
    SeedEntry(ENTRY_INSTALLMENT, "Cadeira gamer", 77_924, "Casa", date(2026, 1, 1), 4),
    SeedEntry(ENTRY_INSTALLMENT, "Jogo Pokemon", 25_732, "Entretenimento", date(2026, 1, 1), 4),
    SeedEntry(ENTRY_INSTALLMENT, "Viagem", 121_704, "Entretenimento", date(2026, 1, 1), 2),
    SeedEntry(ENTRY_INSTALLMENT, "Silent hill F", 22_038, "Entretenimento", date(2026, 1, 1), 2),
    SeedEntry(ENTRY_INSTALLMENT, "Resident evil", 35_180, "Entretenimento", date(2026, 4, 1), 4),
)
