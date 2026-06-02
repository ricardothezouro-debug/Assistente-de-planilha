from finance_app.storage.database import get_database_path
from finance_app.services.finance_service import FinanceService
from finance_app.ui.app import FinanceApp


def main() -> None:
    service = FinanceService(get_database_path())
    service.setup(seed=True)

    app = FinanceApp(service)
    app.run()


if __name__ == "__main__":
    main()
