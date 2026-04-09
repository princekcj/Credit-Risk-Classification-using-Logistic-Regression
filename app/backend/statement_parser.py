"""
Ghana bank statement CSV parser.
Supports: GCB, Ecobank, Stanbic, Standard Chartered, Fidelity, and a generic fallback.
Returns a dict compatible with the scoring model input.
"""

from __future__ import annotations

import io
import re
from collections import defaultdict
from datetime import datetime
from typing import Any

import pandas as pd


# ── column name normalisation ────────────────────────────────────────────────────

_DEBIT_ALIASES  = {"debit", "withdrawal", "dr", "amount_out", "payment", "debit_amount"}
_CREDIT_ALIASES = {"credit", "deposit", "cr", "amount_in", "receipt", "credit_amount"}
_DATE_ALIASES   = {"date", "value_date", "trans_date", "transaction_date", "posting_date"}
_DESC_ALIASES   = {"description", "narration", "particulars", "details", "reference", "remarks"}
_BALANCE_ALIASES= {"balance", "running_balance", "book_balance", "closing_balance"}


def _norm(col: str) -> str:
    return re.sub(r"[^a-z0-9]", "_", col.strip().lower())


def _find_col(df: pd.DataFrame, aliases: set[str]) -> str | None:
    for col in df.columns:
        if _norm(col) in aliases:
            return col
    return None


def _clean_amount(val: Any) -> float:
    if pd.isna(val):
        return 0.0
    s = str(val).replace(",", "").replace(" ", "").strip()
    s = re.sub(r"[^0-9.\-]", "", s)
    try:
        return abs(float(s))
    except ValueError:
        return 0.0


def _parse_date(val: Any) -> datetime | None:
    if pd.isna(val):
        return None
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d %b %Y", "%B %d, %Y", "%d/%m/%y"):
        try:
            return datetime.strptime(str(val).strip(), fmt)
        except ValueError:
            continue
    return None


# ── bank layout detection ────────────────────────────────────────────────────────

def _detect_layout(df: pd.DataFrame) -> str:
    cols_norm = {_norm(c) for c in df.columns}
    if "value_date" in cols_norm and "book_balance" in cols_norm:
        return "gcb"
    if "trans_date" in cols_norm and "cr" in cols_norm and "dr" in cols_norm:
        return "ecobank"
    if "posting_date" in cols_norm and "credit_amount" in cols_norm:
        return "stanbic"
    if "transaction_date" in cols_norm and "debit_amount" in cols_norm:
        return "stanchart"
    if "amount_in" in cols_norm and "amount_out" in cols_norm:
        return "fidelity"
    return "generic"


# ── core parser ──────────────────────────────────────────────────────────────────

def parse_bank_csv(contents: bytes) -> dict:
    warnings: list[str] = []

    try:
        text = contents.decode("utf-8")
    except UnicodeDecodeError:
        text = contents.decode("latin-1")

    # Try to skip preamble rows (non-tabular header lines some banks include)
    lines = text.splitlines()
    start = 0
    for i, line in enumerate(lines[:20]):
        if "," in line and sum(1 for c in line if c == ",") >= 2:
            start = i
            break
    clean_text = "\n".join(lines[start:])

    try:
        df = pd.read_csv(io.StringIO(clean_text))
    except Exception as exc:
        raise ValueError(f"Could not parse CSV: {exc}") from exc

    if df.empty or len(df.columns) < 2:
        raise ValueError("The CSV appears to be empty or has too few columns.")

    layout = _detect_layout(df)

    date_col   = _find_col(df, _DATE_ALIASES)
    debit_col  = _find_col(df, _DEBIT_ALIASES)
    credit_col = _find_col(df, _CREDIT_ALIASES)
    desc_col   = _find_col(df, _DESC_ALIASES)
    bal_col    = _find_col(df, _BALANCE_ALIASES)

    if credit_col is None and debit_col is None:
        raise ValueError(
            "Could not identify debit/credit columns. "
            "Ensure the CSV has columns named 'Debit', 'Credit', 'DR', 'CR', etc."
        )

    # parse amounts
    df["_credit"] = df[credit_col].apply(_clean_amount) if credit_col else 0.0
    df["_debit"]  = df[debit_col].apply(_clean_amount)  if debit_col  else 0.0

    # parse dates and group by month
    months_seen: set[str] = set()
    if date_col:
        df["_date"] = df[date_col].apply(_parse_date)
        df["_month"] = df["_date"].apply(
            lambda d: d.strftime("%Y-%m") if d else None
        )
        months_seen = set(df["_month"].dropna().unique())
    else:
        warnings.append("No date column found; month detection unavailable.")

    num_months = max(len(months_seen), 1)

    total_credits = df["_credit"].sum()
    total_debits  = df["_debit"].sum()
    transactions  = len(df)

    # ── estimate monthly income (credits) ────────────────────────────────────────
    avg_monthly_income   = total_credits / num_months
    avg_monthly_expenses = total_debits  / num_months

    # ── employment type guess ─────────────────────────────────────────────────────
    employment_type = "employed"
    if avg_monthly_income == 0:
        employment_type = "unemployed"
    elif avg_monthly_income < 500:
        employment_type = "self_employed"

    # ── rent consistency ──────────────────────────────────────────────────────────
    rent_keywords = re.compile(
        r"(rent|landlord|property|house|accommodation|utilities|electricity|water|ecg|gwcl)",
        re.IGNORECASE,
    )
    rent_consistency = 0.0
    if desc_col and date_col and num_months > 0:
        rent_rows = df[df[desc_col].astype(str).str.contains(rent_keywords, na=False)]
        months_with_rent = len(set(rent_rows["_month"].dropna()))
        rent_consistency = min(months_with_rent / num_months, 1.0)
        if rent_rows.empty:
            rent_consistency = 0.5
            warnings.append("No clear rent/utility payments detected; defaulting consistency to 0.5.")
    else:
        rent_consistency = 0.5

    # ── mobile money transactions ─────────────────────────────────────────────────
    momo_keywords = re.compile(r"(momo|mtn|vodafone|airtel|tigo|mobile money|mm)", re.IGNORECASE)
    momo_count = 0
    if desc_col:
        momo_count = int(df[desc_col].astype(str).str.contains(momo_keywords, na=False).sum())

    # ── savings estimate (final balance) ─────────────────────────────────────────
    savings = 0.0
    if bal_col:
        last_balance = df[bal_col].apply(_clean_amount).dropna()
        if not last_balance.empty:
            savings = last_balance.iloc[-1]
    if savings == 0.0:
        surplus = avg_monthly_income - avg_monthly_expenses
        savings = max(surplus * num_months * 0.3, 0.0)

    summary_parts = [
        f"Parsed {transactions} transactions over {num_months} month(s).",
        f"Average monthly income: ₵{avg_monthly_income:,.2f}.",
        f"Average monthly expenses: ₵{avg_monthly_expenses:,.2f}.",
        f"Bank layout detected: {layout}.",
    ]

    return {
        "income":              round(avg_monthly_income, 2),
        "expenses":            round(avg_monthly_expenses, 2),
        "rent_consistency":    round(rent_consistency, 2),
        "mobile_transactions": momo_count,
        "savings":             round(savings, 2),
        "employment_type":     employment_type,
        "transactions_found":  transactions,
        "months_detected":     num_months,
        "bank_layout":         layout,
        "summary":             " ".join(summary_parts),
        "warnings":            warnings,
    }
