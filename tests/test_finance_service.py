from datetime import date
from pathlib import Path
import tempfile
import unittest

from finance_app.domain.constants import (
    ENTRY_FIXED,
    ENTRY_INCOME,
    ENTRY_INSTALLMENT,
    ENTRY_VARIABLE,
    STATUS_PAID,
    STATUS_UNPAID,
)
from finance_app.domain.money import split_amount
from finance_app.services.finance_service import FinanceService, default_status_for_date


class FinanceServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "financeiro.db"
        self.service = FinanceService(self.db_path)
        self.service.setup(seed=False)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_default_status_until_may_is_paid(self) -> None:
        self.assertEqual(default_status_for_date(date(2026, 5, 31)), STATUS_PAID)
        self.assertEqual(default_status_for_date(date(2026, 6, 1)), STATUS_UNPAID)

    def test_installments_are_created_in_correct_months(self) -> None:
        self.service.create_entry(
            entry_type=ENTRY_INSTALLMENT,
            name="Resident Evil 9",
            amount_cents=35_900,
            category="Entretenimento",
            start_date=date(2026, 5, 7),
            installments=4,
        )

        may = self.service.list_occurrences(2026, 5)
        june = self.service.list_occurrences(2026, 6)
        august = self.service.list_occurrences(2026, 8)

        self.assertEqual(len(may), 1)
        self.assertEqual(len(june), 1)
        self.assertEqual(len(august), 1)
        self.assertEqual(may[0]["amount_cents"], 8_975)
        self.assertEqual(may[0]["installment_number"], 1)
        self.assertEqual(august[0]["installment_number"], 4)
        self.assertEqual(may[0]["status"], STATUS_PAID)
        self.assertEqual(june[0]["status"], STATUS_UNPAID)

    def test_split_amount_adjusts_last_installment(self) -> None:
        self.assertEqual(split_amount(1_000, 3), [333, 333, 334])

    def test_fixed_entry_repeats_from_start_month_to_december(self) -> None:
        self.service.create_entry(
            entry_type=ENTRY_FIXED,
            name="Vivo",
            amount_cents=4_300,
            category="Assinatura",
            start_date=date(2026, 2, 1),
        )

        self.assertEqual(len(self.service.list_occurrences(2026, 1)), 0)
        self.assertEqual(len(self.service.list_occurrences(2026, 2)), 1)
        self.assertEqual(len(self.service.list_occurrences(2026, 12)), 1)
        self.assertEqual(self.service.list_occurrences(2026, 5)[0]["status"], STATUS_PAID)
        self.assertEqual(self.service.list_occurrences(2026, 6)[0]["status"], STATUS_UNPAID)

    def test_investment_reduces_balance_and_counts_when_paid(self) -> None:
        self.service.create_entry(
            entry_type=ENTRY_INCOME,
            name="Salario",
            amount_cents=500_000,
            category="Outros",
            start_date=date(2026, 5, 5),
        )
        self.service.create_entry(
            entry_type=ENTRY_VARIABLE,
            name="Aporte",
            amount_cents=100_000,
            category="Investimento",
            start_date=date(2026, 5, 10),
        )
        self.service.create_entry(
            entry_type=ENTRY_VARIABLE,
            name="Aporte futuro",
            amount_cents=50_000,
            category="Investimento",
            start_date=date(2026, 6, 10),
        )

        may = self.service.monthly_summary(2026, 5)
        june = self.service.monthly_summary(2026, 6)

        self.assertEqual(may["balance"], 400_000)
        self.assertEqual(may["invested_month"], 100_000)
        self.assertEqual(may["invested_year"], 700_000)
        self.assertEqual(june["balance"], -50_000)
        self.assertEqual(june["invested_year"], 700_000)

    def test_can_update_initial_invested_amount(self) -> None:
        self.service.update_initial_invested_cents(900_000)

        summary = self.service.monthly_summary(2026, 5)

        self.assertEqual(summary["initial_invested"], 900_000)
        self.assertEqual(summary["invested_year"], 900_000)

    def test_deleting_variable_removes_only_that_entry(self) -> None:
        self.service.create_entry(
            entry_type=ENTRY_VARIABLE,
            name="Mercado",
            amount_cents=15_000,
            category="Comida",
            start_date=date(2026, 5, 2),
        )
        occurrence = self.service.list_occurrences(2026, 5)[0]

        self.service.delete_entry_by_occurrence(occurrence["id"])

        self.assertEqual(self.service.list_occurrences(2026, 5), [])

    def test_deleting_installment_removes_all_months(self) -> None:
        self.service.create_entry(
            entry_type=ENTRY_INSTALLMENT,
            name="Resident Evil 9",
            amount_cents=35_900,
            category="Entretenimento",
            start_date=date(2026, 5, 7),
            installments=4,
        )
        occurrence = self.service.list_occurrences(2026, 6)[0]

        self.service.delete_entry_by_occurrence(occurrence["id"])

        self.assertEqual(self.service.list_occurrences(2026, 5), [])
        self.assertEqual(self.service.list_occurrences(2026, 6), [])
        self.assertEqual(self.service.list_occurrences(2026, 7), [])
        self.assertEqual(self.service.list_occurrences(2026, 8), [])

    def test_deleting_single_installment_keeps_other_installments(self) -> None:
        self.service.create_entry(
            entry_type=ENTRY_INSTALLMENT,
            name="Resident Evil 9",
            amount_cents=35_900,
            category="Entretenimento",
            start_date=date(2026, 5, 7),
            installments=4,
        )
        june = self.service.list_occurrences(2026, 6)[0]

        self.service.delete_single_occurrence(june["id"])

        self.assertEqual(len(self.service.list_occurrences(2026, 5)), 1)
        self.assertEqual(self.service.list_occurrences(2026, 6), [])
        self.assertEqual(len(self.service.list_occurrences(2026, 7)), 1)
        self.assertEqual(len(self.service.list_occurrences(2026, 8)), 1)

    def test_deleting_installments_from_selected_month_keeps_previous_installments(self) -> None:
        self.service.create_entry(
            entry_type=ENTRY_INSTALLMENT,
            name="Resident Evil 9",
            amount_cents=35_900,
            category="Entretenimento",
            start_date=date(2026, 5, 7),
            installments=4,
        )
        june = self.service.list_occurrences(2026, 6)[0]

        self.service.delete_occurrences_from_selected_month(june["id"])

        self.assertEqual(len(self.service.list_occurrences(2026, 5)), 1)
        self.assertEqual(self.service.list_occurrences(2026, 6), [])
        self.assertEqual(self.service.list_occurrences(2026, 7), [])
        self.assertEqual(self.service.list_occurrences(2026, 8), [])

    def test_deleting_single_fixed_occurrence_keeps_other_months(self) -> None:
        self.service.create_entry(
            entry_type=ENTRY_FIXED,
            name="Vivo",
            amount_cents=4_300,
            category="Assinatura",
            start_date=date(2026, 2, 1),
        )
        may = self.service.list_occurrences(2026, 5)[0]

        self.service.delete_single_occurrence(may["id"])

        self.assertEqual(self.service.list_occurrences(2026, 4)[0]["name"], "Vivo")
        self.assertEqual(self.service.list_occurrences(2026, 5), [])
        self.assertEqual(self.service.list_occurrences(2026, 6)[0]["name"], "Vivo")

    def test_deleting_fixed_from_selected_month_keeps_previous_months(self) -> None:
        self.service.create_entry(
            entry_type=ENTRY_FIXED,
            name="Vivo",
            amount_cents=4_300,
            category="Assinatura",
            start_date=date(2026, 2, 1),
        )
        may = self.service.list_occurrences(2026, 5)[0]

        self.service.delete_occurrences_from_selected_month(may["id"])

        self.assertEqual(self.service.list_occurrences(2026, 4)[0]["name"], "Vivo")
        self.assertEqual(self.service.list_occurrences(2026, 5), [])
        self.assertEqual(self.service.list_occurrences(2026, 6), [])
        self.assertEqual(self.service.list_occurrences(2026, 12), [])

    def test_can_add_custom_category_and_use_it(self) -> None:
        category = self.service.add_category("Pets")

        self.service.create_entry(
            entry_type=ENTRY_VARIABLE,
            name="Racao",
            amount_cents=12_000,
            category=category,
            start_date=date(2026, 5, 3),
        )

        occurrence = self.service.list_occurrences(2026, 5)[0]
        self.assertEqual(category, "Pets")
        self.assertIn("Pets", self.service.all_categories())
        self.assertEqual(occurrence["category"], "Pets")

    def test_add_category_reuses_existing_name_case_insensitive(self) -> None:
        category = self.service.add_category("comida")

        self.assertEqual(category, "Comida")

    def test_chart_totals_group_month_and_year(self) -> None:
        self.service.create_entry(
            entry_type=ENTRY_INCOME,
            name="Salario",
            amount_cents=500_000,
            category="Outros",
            start_date=date(2026, 5, 5),
        )
        self.service.create_entry(
            entry_type=ENTRY_VARIABLE,
            name="Mercado",
            amount_cents=20_000,
            category="Comida",
            start_date=date(2026, 5, 6),
        )
        self.service.create_entry(
            entry_type=ENTRY_VARIABLE,
            name="Cinema",
            amount_cents=8_000,
            category="Entretenimento",
            start_date=date(2026, 5, 7),
        )

        category_totals = self.service.monthly_category_totals(2026, 5)
        yearly_totals = self.service.yearly_monthly_totals(2026)

        self.assertEqual(category_totals[0], {"category": "Comida", "total": 20_000})
        self.assertEqual(category_totals[1], {"category": "Entretenimento", "total": 8_000})
        self.assertEqual(yearly_totals[4]["income"], 500_000)
        self.assertEqual(yearly_totals[4]["expenses"], 28_000)
        self.assertEqual(yearly_totals[4]["balance"], 472_000)


if __name__ == "__main__":
    unittest.main()
