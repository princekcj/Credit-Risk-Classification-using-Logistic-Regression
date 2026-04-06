from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import uuid
import os

from model import (
    predict_score, predict_risk, normalize_score, get_band,
    get_model, get_model_meta, retrain_with_csv, UPLOAD_COLUMNS
)
from utils import get_factors, get_tips, get_explanation, get_ai_response
from database import (
    init_db, save_score, get_recent_scores,
    create_company, list_companies, authenticate_company,
    create_company_session, get_company_by_token, delete_company_session,
    save_business_check, get_business_checks
)
from auth import verify_admin
from statement_parser import parse_bank_csv
from momo import get_auth_url, handle_callback

_HERE     = os.path.dirname(os.path.abspath(__file__))
_DIST_DIR = os.path.join(_HERE, "..", "frontend", "dist")

app = FastAPI(title="ClearScore API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def strip_api_prefix(request: Request, call_next):
    if request.url.path.startswith("/api/"):
        request.scope["path"] = request.scope["path"][4:]
    return await call_next(request)


@app.on_event("startup")
def startup():
    init_db()
    get_model()


# ── shared models ───────────────────────────────────────────────────────────────

class ScoreInput(BaseModel):
    income: float
    employment_type: str
    expenses: float
    rent_consistency: float
    mobile_transactions: int
    savings: float
    region: Optional[str] = None
    session_id: Optional[str] = None


class ExplainInput(BaseModel):
    income: float
    employment_type: str
    expenses: float
    rent_consistency: float
    mobile_transactions: int
    savings: float
    score: int
    region: Optional[str] = None
    session_id: Optional[str] = None


class ChatInput(BaseModel):
    message: str
    income: float
    employment_type: str
    expenses: float
    rent_consistency: float
    mobile_transactions: int
    savings: float
    score: int
    region: Optional[str] = None


# ── company auth dependency ─────────────────────────────────────────────────────

def get_current_company(authorization: str = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Company authentication required.")
    token = authorization[7:]
    company = get_company_by_token(token)
    if not company:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")
    return company


# ── public endpoints ────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "message": "ClearScore API is running"}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/predict")
def predict(data: ScoreInput):
    input_dict = {
        "income": data.income,
        "employment_type": data.employment_type,
        "expenses": data.expenses,
        "rent_consistency": data.rent_consistency,
        "mobile_transactions": data.mobile_transactions,
        "savings": data.savings,
        "region": data.region,
    }

    proba_healthy = predict_score(input_dict)
    score = normalize_score(proba_healthy)
    band  = get_band(score)
    risk  = predict_risk(input_dict)

    factors = get_factors(input_dict, risk["derived_features"])
    tips    = get_tips(input_dict, risk["derived_features"])

    session_id = data.session_id or str(uuid.uuid4())
    save_score(session_id, input_dict, score, band)

    return {
        "score":            score,
        "band":             band,
        "factors":          factors,
        "tips":             tips,
        "session_id":       session_id,
        "model_prediction": "healthy" if risk["prediction"] == 0 else "high-risk",
        "confidence":       round(max(risk["probability_healthy"], risk["probability_high_risk"]) * 100, 1),
    }


@app.post("/explain")
def explain(data: ExplainInput):
    input_dict = {
        "income": data.income,
        "employment_type": data.employment_type,
        "expenses": data.expenses,
        "rent_consistency": data.rent_consistency,
        "mobile_transactions": data.mobile_transactions,
        "savings": data.savings,
        "region": data.region,
    }
    risk        = predict_risk(input_dict)
    factors     = get_factors(input_dict, risk["derived_features"])
    tips        = get_tips(input_dict, risk["derived_features"])
    explanation = get_explanation(input_dict, data.score, get_band(data.score), risk)
    return {
        "explanation":      explanation,
        "positive_factors": [f for f in factors if f["impact"] == "+"],
        "negative_factors": [f for f in factors if f["impact"] == "-"],
        "suggestions":      tips[:3],
    }


@app.post("/chat")
def chat(data: ChatInput):
    input_dict = {
        "income": data.income,
        "employment_type": data.employment_type,
        "expenses": data.expenses,
        "rent_consistency": data.rent_consistency,
        "mobile_transactions": data.mobile_transactions,
        "savings": data.savings,
        "region": data.region,
    }
    risk     = predict_risk(input_dict)
    factors  = get_factors(input_dict, risk["derived_features"])
    response = get_ai_response(data.message, input_dict, data.score, factors, risk)
    return {"response": response}


@app.get("/stats")
def stats():
    recent = get_recent_scores(20)
    if not recent:
        return {"average_score": 0, "total_checks": 0, "band_distribution": {}}
    scores   = [r["score"] for r in recent]
    avg      = round(sum(scores) / len(scores))
    band_dist = {}
    for r in recent:
        b = r["band"]
        band_dist[b] = band_dist.get(b, 0) + 1
    return {"average_score": avg, "total_checks": len(recent), "band_distribution": band_dist}


# ── data ingestion endpoints ────────────────────────────────────────────────────

class MomoCallbackInput(BaseModel):
    code:  str
    state: str


@app.post("/parse/bank-statement")
async def parse_bank_statement(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a CSV file.")
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 5 MB.")
    try:
        result = parse_bank_csv(contents)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {
        "source":              "bank_statement",
        "income":              result["income"],
        "expenses":            result["expenses"],
        "rent_consistency":    result["rent_consistency"],
        "mobile_transactions": result["mobile_transactions"],
        "savings":             result["savings"],
        "employment_type":     result["employment_type"],
        "transactions_found":  result["transactions_found"],
        "months_detected":     result["months_detected"],
        "bank_layout":         result["bank_layout"],
        "summary":             result["summary"],
        "warnings":            result["warnings"],
    }


@app.get("/momo/auth-url")
def momo_auth_url(redirect_uri: Optional[str] = None):
    return get_auth_url(redirect_uri)


@app.post("/momo/callback")
def momo_callback(body: MomoCallbackInput):
    result = handle_callback(body.code, body.state)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "MoMo auth failed."))
    return result


# ── business (company) endpoints ────────────────────────────────────────────────

class CompanyLoginInput(BaseModel):
    email: str
    password: str


@app.post("/business/login")
def business_login(body: CompanyLoginInput):
    company = authenticate_company(body.email, body.password)
    if not company:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    token = create_company_session(company["id"])
    return {"token": token, "name": company["name"], "email": company["email"]}


@app.post("/business/logout")
def business_logout(company=Depends(get_current_company),
                    authorization: str = Header(default=None)):
    token = authorization[7:] if authorization else ""
    delete_company_session(token)
    return {"success": True}


@app.post("/business/check-credit")
async def business_check_credit(
    file: UploadFile = File(...),
    client_ref: Optional[str] = None,
    company=Depends(get_current_company),
):
    """
    Accept up to 3 months of a client's bank statement CSV, parse it,
    run the credit model, and return a score with factors and tips.
    """
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a CSV bank statement export.")

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10 MB.")

    try:
        parsed = parse_bank_csv(contents)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    input_dict = {
        "income":              parsed["income"],
        "employment_type":     parsed["employment_type"],
        "expenses":            parsed["expenses"],
        "rent_consistency":    parsed["rent_consistency"],
        "mobile_transactions": parsed["mobile_transactions"],
        "savings":             parsed["savings"],
    }

    proba_healthy = predict_score(input_dict)
    score = normalize_score(proba_healthy)
    band  = get_band(score)
    risk  = predict_risk(input_dict)
    factors = get_factors(input_dict, risk["derived_features"])
    tips    = get_tips(input_dict, risk["derived_features"])

    save_business_check(
        company_id=company["id"],
        client_ref=client_ref or "",
        score=score,
        band=band,
        months=parsed.get("months_detected", 0),
        parsed_data={
            "income":              parsed["income"],
            "expenses":            parsed["expenses"],
            "rent_consistency":    parsed["rent_consistency"],
            "mobile_transactions": parsed["mobile_transactions"],
            "savings":             parsed["savings"],
            "bank_layout":         parsed["bank_layout"],
        },
    )

    return {
        "score":            score,
        "band":             band,
        "factors":          factors,
        "tips":             tips[:4],
        "model_prediction": "healthy" if risk["prediction"] == 0 else "high-risk",
        "confidence":       round(max(risk["probability_healthy"], risk["probability_high_risk"]) * 100, 1),
        "months_analysed":  parsed.get("months_detected", 0),
        "bank_layout":      parsed.get("bank_layout", "unknown"),
        "income":           parsed["income"],
        "expenses":         parsed["expenses"],
        "warnings":         parsed.get("warnings", []),
    }


@app.get("/business/history")
def business_history(company=Depends(get_current_company)):
    checks = get_business_checks(company["id"])
    return {"checks": checks, "total": len(checks)}


@app.get("/business/me")
def business_me(company=Depends(get_current_company)):
    return {"name": company["name"], "email": company["email"]}


# ── admin endpoints ─────────────────────────────────────────────────────────────

@app.get("/admin/model-info", dependencies=[Depends(verify_admin)])
def admin_model_info():
    meta = get_model_meta()
    return {
        "trained_at":        meta.get("trained_at", "unknown"),
        "total_samples":     meta.get("total_samples", 0),
        "healthy_samples":   meta.get("healthy_samples", 0),
        "risky_samples":     meta.get("risky_samples", 0),
        "accuracy":          meta.get("accuracy", 0),
        "precision_healthy": meta.get("precision_0", 0),
        "recall_healthy":    meta.get("recall_0", 0),
        "precision_risky":   meta.get("precision_1", 0),
        "recall_risky":      meta.get("recall_1", 0),
        "upload_columns":    UPLOAD_COLUMNS,
    }


@app.post("/admin/retrain", dependencies=[Depends(verify_admin)])
async def admin_retrain(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted.")
    contents = await file.read()
    result   = retrain_with_csv(contents)
    if not result["success"]:
        raise HTTPException(status_code=422, detail=result["error"])
    return result


class CreateCompanyInput(BaseModel):
    name: str
    email: str
    password: str


@app.post("/admin/companies", dependencies=[Depends(verify_admin)])
def admin_create_company(body: CreateCompanyInput):
    company = create_company(body.name, body.email, body.password)
    if not company:
        raise HTTPException(status_code=409, detail="A company with that email already exists.")
    return company


@app.get("/admin/companies", dependencies=[Depends(verify_admin)])
def admin_list_companies():
    return {"companies": list_companies()}


# ── SPA static file serving ─────────────────────────────────────────────────────

if os.path.isdir(_DIST_DIR):
    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        candidate = os.path.join(_DIST_DIR, full_path)
        if os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(_DIST_DIR, "index.html"))
