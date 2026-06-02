from __future__ import annotations

import calendar
from datetime import date
import tkinter as tk
from tkinter import ttk
from typing import Callable

from finance_app.domain.constants import MONTH_NAMES


class CalendarPicker(tk.Toplevel):
    def __init__(self, parent: tk.Misc, on_select: Callable[[date], None]) -> None:
        super().__init__(parent)
        self.on_select = on_select
        self.today = date.today()
        self.visible_year = self.today.year
        self.visible_month = self.today.month

        self.title("Escolher data")
        self.resizable(False, False)
        self.transient(parent)
        self.grab_set()

        self.header = ttk.Frame(self, padding=8)
        self.header.grid(row=0, column=0, sticky="ew")
        self.header.columnconfigure(1, weight=1)

        ttk.Button(self.header, text="<", width=3, command=self.previous_month).grid(row=0, column=0)
        self.title_var = tk.StringVar()
        ttk.Label(self.header, textvariable=self.title_var, anchor="center").grid(
            row=0,
            column=1,
            sticky="ew",
            padx=8,
        )
        ttk.Button(self.header, text=">", width=3, command=self.next_month).grid(row=0, column=2)

        self.days_frame = ttk.Frame(self, padding=(8, 0, 8, 8))
        self.days_frame.grid(row=1, column=0)

        self.render_days()
        self.bind("<Escape>", lambda _event: self.destroy())

    def previous_month(self) -> None:
        if self.visible_month == 1:
            self.visible_month = 12
            self.visible_year -= 1
        else:
            self.visible_month -= 1
        self.render_days()

    def next_month(self) -> None:
        if self.visible_month == 12:
            self.visible_month = 1
            self.visible_year += 1
        else:
            self.visible_month += 1
        self.render_days()

    def render_days(self) -> None:
        for widget in self.days_frame.winfo_children():
            widget.destroy()

        self.title_var.set(f"{MONTH_NAMES[self.visible_month - 1]} {self.visible_year}")

        weekdays = ("Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom")
        for column, label in enumerate(weekdays):
            ttk.Label(self.days_frame, text=label, anchor="center", width=5).grid(
                row=0,
                column=column,
                padx=1,
                pady=(0, 4),
            )

        weeks = calendar.monthcalendar(self.visible_year, self.visible_month)
        for row_index, week in enumerate(weeks, start=1):
            for column, day in enumerate(week):
                if day == 0:
                    ttk.Label(self.days_frame, text="", width=5).grid(row=row_index, column=column, padx=1, pady=1)
                    continue

                selected_date = date(self.visible_year, self.visible_month, day)
                text = str(day)
                if selected_date == self.today:
                    text = f"[{day}]"

                ttk.Button(
                    self.days_frame,
                    text=text,
                    width=5,
                    command=lambda value=selected_date: self.select_date(value),
                ).grid(row=row_index, column=column, padx=1, pady=1)

    def select_date(self, value: date) -> None:
        self.on_select(value)
        self.destroy()
