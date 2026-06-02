from datetime import date

ACTIVE_YEAR = 2026
INITIAL_INVESTED_CENTS = 600_000
PAID_CUTOFF = date(2026, 5, 31)

ENTRY_FIXED = "Fixa"
ENTRY_VARIABLE = "Variavel"
ENTRY_INSTALLMENT = "Parcela"
ENTRY_INCOME = "Recebido"

ENTRY_TYPES = (
    ENTRY_FIXED,
    ENTRY_VARIABLE,
    ENTRY_INSTALLMENT,
    ENTRY_INCOME,
)

STATUS_PAID = "Pago"
STATUS_UNPAID = "Nao pago"

STATUSES = (
    STATUS_PAID,
    STATUS_UNPAID,
)

CATEGORIES = (
    "Comida",
    "Entretenimento",
    "Investimento",
    "Outros",
    "Casa",
    "Assinatura",
    "Saude",
    "Transporte",
)

MONTH_NAMES = (
    "Janeiro",
    "Fevereiro",
    "Marco",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
)
