from decimal import Decimal, InvalidOperation, ROUND_HALF_UP


def parse_money_to_cents(value: str) -> int:
    raw = value.strip().replace("R$", "").replace(" ", "")
    if not raw:
        raise ValueError("Informe um valor.")

    if "," in raw:
        raw = raw.replace(".", "").replace(",", ".")
    elif "." in raw:
        last_group = raw.rsplit(".", 1)[-1]
        if len(last_group) == 3:
            raw = raw.replace(".", "")

    try:
        decimal_value = Decimal(raw)
    except InvalidOperation as exc:
        raise ValueError(f"Valor invalido: {value}") from exc

    cents = (decimal_value * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return int(cents)


def format_cents(cents: int) -> str:
    sign = "-" if cents < 0 else ""
    cents = abs(cents)
    reais, centavos = divmod(cents, 100)
    inteiro = f"{reais:,}".replace(",", ".")
    return f"{sign}R$ {inteiro},{centavos:02d}"


def split_amount(total_cents: int, parts: int) -> list[int]:
    if parts <= 0:
        raise ValueError("A quantidade de parcelas deve ser maior que zero.")

    base, remainder = divmod(total_cents, parts)
    amounts = [base for _ in range(parts)]
    amounts[-1] += remainder
    return amounts
