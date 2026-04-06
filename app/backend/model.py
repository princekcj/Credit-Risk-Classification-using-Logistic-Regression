"""
Logistic Regression model — original lending feature set (identical to notebook).

Features (X = df.drop(columns='loan_status') from lending_data.csv):
  loan_size           - loan amount requested / issued
  interest_rate       - loan interest rate (%)
  borrower_income     - annual borrower income
  debt_to_income      - ratio of total debt obligations to income
  num_of_accounts     - number of open credit / bank accounts
  derogatory_marks    - count of negative credit events (missed payments, defaults)
  total_debt          - total outstanding debt

Training data: Credit_Risk/Resources/lending_data.csv  (~77,000 rows, no changes needed)
Upload format: exactly these 7 columns + loan_status — no translation performed.

For individual user scoring (form inputs), alternative financial signals are
translated to these 7 lending features before scoring — see _build_feature_vector().

Pipeline: StandardScaler → LogisticRegression (RandomOverSampler on training fold).
Model is pickled to app/backend/model.pkl and reloaded on restart.
Admin retrain endpoint appends new CSV rows, retrains, and repickles.
"""

import io
import pickle
import time
from pathlib import Path

import numpy as np
import pandas as pd
from imblearn.over_sampling import RandomOverSampler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

DATA_PATH         = Path(__file__).resolve().parents[2] / "Credit_Risk" / "Resources" / "lending_data.csv"
MODEL_PICKLE_PATH = Path(__file__).resolve().parent / "model.pkl"

_FEATURE_NAMES = [
    "loan_size",
    "interest_rate",
    "borrower_income",
    "debt_to_income",
    "num_of_accounts",
    "derogatory_marks",
    "total_debt",
]

# All CSV uploads must have exactly these columns (matches lending_data.csv headers)
UPLOAD_COLUMNS = _FEATURE_NAMES + ["loan_status"]

# Runtime state
_pipeline:   Pipeline | None = None
_model_meta: dict            = {}


# ── training ───────────────────────────────────────────────────────────────────

def _train_pipeline(df: pd.DataFrame) -> tuple[Pipeline, dict]:
    X = df[_FEATURE_NAMES].astype(float)
    y = df["loan_status"].astype(int)

    X_train, X_test, y_train, y_test = train_test_split(X, y, random_state=1, stratify=y)

    ros = RandomOverSampler(random_state=1)
    X_res, y_res = ros.fit_resample(X_train, y_train)

    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("lr",     LogisticRegression(solver="lbfgs", max_iter=500, random_state=1, C=1.0)),
    ])
    pipeline.fit(X_res, y_res)

    y_pred   = pipeline.predict(X_test)
    accuracy = round(float(accuracy_score(y_test, y_pred)) * 100, 2)
    report   = classification_report(y_test, y_pred, output_dict=True)

    meta = {
        "trained_at":      time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        "total_samples":   len(df),
        "healthy_samples": int((df["loan_status"] == 0).sum()),
        "risky_samples":   int((df["loan_status"] == 1).sum()),
        "accuracy":        accuracy,
        "precision_0":     round(report["0"]["precision"] * 100, 2),
        "recall_0":        round(report["0"]["recall"]    * 100, 2),
        "precision_1":     round(report["1"]["precision"] * 100, 2),
        "recall_1":        round(report["1"]["recall"]    * 100, 2),
        "data_source":     str(DATA_PATH),
        "feature_names":   _FEATURE_NAMES,
    }
    return pipeline, meta


def _save_pickle(pipeline: Pipeline, meta: dict) -> None:
    with open(MODEL_PICKLE_PATH, "wb") as f:
        pickle.dump({"pipeline": pipeline, "meta": meta}, f)


def _load_pickle() -> tuple[Pipeline, dict] | None:
    if not MODEL_PICKLE_PATH.exists():
        return None
    try:
        with open(MODEL_PICKLE_PATH, "rb") as f:
            obj = pickle.load(f)
        saved_features = obj.get("meta", {}).get("feature_names", [])
        if saved_features != _FEATURE_NAMES:
            return None  # Stale pickle from old feature set — retrain
        return obj["pipeline"], obj["meta"]
    except Exception:
        return None


def _initialise() -> None:
    global _pipeline, _model_meta

    loaded = _load_pickle()
    if loaded:
        _pipeline, _model_meta = loaded
        return

    if not DATA_PATH.exists():
        raise RuntimeError(
            f"Training data not found at {DATA_PATH}. "
            "Ensure lending_data.csv is present in Credit_Risk/Resources/."
        )

    df = pd.read_csv(DATA_PATH)
    _pipeline, _model_meta = _train_pipeline(df)
    _save_pickle(_pipeline, _model_meta)


def get_model() -> Pipeline:
    global _pipeline
    if _pipeline is None:
        _initialise()
    return _pipeline


def get_model_meta() -> dict:
    if not _model_meta:
        _initialise()
    return _model_meta


# ── admin: retrain with uploaded CSV ───────────────────────────────────────────

def retrain_with_csv(csv_bytes: bytes) -> dict:
    global _pipeline, _model_meta

    try:
        new_df = pd.read_csv(io.BytesIO(csv_bytes))
    except Exception as e:
        return {"success": False, "error": f"Could not parse CSV: {e}"}

    missing = [c for c in UPLOAD_COLUMNS if c not in new_df.columns]
    if missing:
        return {
            "success": False,
            "error": (
                f"Missing required columns: {', '.join(missing)}. "
                f"Required: {', '.join(UPLOAD_COLUMNS)}."
            ),
            "required_columns": UPLOAD_COLUMNS,
        }

    if not new_df["loan_status"].isin([0, 1]).all():
        return {"success": False, "error": "loan_status must be 0 (healthy) or 1 (high-risk)."}

    if new_df["loan_status"].nunique() < 2:
        return {"success": False, "error": "Uploaded data must contain both class 0 and class 1 rows."}

    new_df    = new_df[UPLOAD_COLUMNS].copy()
    new_rows  = len(new_df)

    if DATA_PATH.exists():
        existing_df = pd.read_csv(DATA_PATH)
        combined_df = pd.concat([existing_df, new_df], ignore_index=True)
        combined_df.drop_duplicates(inplace=True)
    else:
        combined_df = new_df.copy()

    combined_df.to_csv(DATA_PATH, index=False)

    _pipeline, _model_meta = _train_pipeline(combined_df)
    _save_pickle(_pipeline, _model_meta)

    return {
        "success":        True,
        "new_rows_added": new_rows,
        "total_samples":  _model_meta["total_samples"],
        "accuracy":       _model_meta["accuracy"],
        "trained_at":     _model_meta["trained_at"],
    }


# ── feature vector: translate form inputs → lending model features ──────────────

def _build_feature_vector(data: dict) -> dict:
    """
    Translate user form inputs (alternative financial signals) into the 7
    original lending model features.

    Form input              →  Model feature          Translation
    ─────────────────────────────────────────────────────────────────────────────
    income (monthly)        →  borrower_income        × 12  (annualise)
    expenses / income       →  debt_to_income         ratio of monthly obligations
    mobile_transactions     →  num_of_accounts        ÷ 3  (≈ accounts per service)
    1 − rent_consistency    →  derogatory_marks       × 5  (0=perfect, 5=never pays)
    expenses × 12           →  total_debt             annual obligations proxy
    income × 6              →  loan_size              representative 6-month micro-loan
    12.5                    →  interest_rate          Ghana microfinance median (%)
    """
    income              = float(data.get("income", 0))
    expenses            = float(data.get("expenses", 0))
    rent_consistency    = float(data.get("rent_consistency", 1.0))
    mobile_transactions = float(data.get("mobile_transactions", 0))

    return {
        "loan_size":        round(income * 6, 2),
        "interest_rate":    12.5,
        "borrower_income":  round(income * 12, 2),
        "debt_to_income":   round((expenses / income) if income > 0 else 0.0, 4),
        "num_of_accounts":  max(0, round(mobile_transactions / 3)),
        "derogatory_marks": round((1.0 - rent_consistency) * 5),
        "total_debt":       round(expenses * 12, 2),
    }


# ── public prediction API ──────────────────────────────────────────────────────

def predict_score(data: dict) -> float:
    """P(class=0, healthy borrower) ∈ [0, 1]."""
    features = _build_feature_vector(data)
    model    = get_model()
    X        = pd.DataFrame([features], columns=_FEATURE_NAMES)
    return float(model.predict_proba(X)[0][0])


def predict_risk(data: dict) -> dict:
    features = _build_feature_vector(data)
    model    = get_model()
    X        = pd.DataFrame([features], columns=_FEATURE_NAMES)
    label    = int(model.predict(X)[0])
    proba    = model.predict_proba(X)[0]
    return {
        "prediction":            label,
        "probability_healthy":   float(proba[0]),
        "probability_high_risk": float(proba[1]),
        "derived_features":      features,
    }


def normalize_score(proba_healthy: float) -> int:
    return int(300 + round(proba_healthy * 550))


def get_band(score: int) -> str:
    if score < 580:
        return "Poor"
    elif score < 670:
        return "Fair"
    elif score < 740:
        return "Good"
    else:
        return "Excellent"
