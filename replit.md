# ClearScore – Alternative Credit Score Web App

## Project Overview

A mobile-first fintech web app that lets unbanked users in Ghana check a credit score (300–850) derived from alternative financial data. Also includes a **Business Portal** where microfinance companies log in and upload a client's 3-month bank statement to get an instant credit score.

Two user paths:
1. **Individual** – fill in income, expenses, savings etc. → credit score
2. **Business** – company logs in → uploads client bank statement CSV → instant score with factors and tips

## Tech Stack

**Frontend:**
- React 18 + Vite
- Tailwind CSS v4
- React Router DOM
- Axios

**Backend:**
- Python 3.11 + FastAPI
- Uvicorn
- SQLite (aiosqlite)

## Project Structure

```
app/
  frontend/                  React + Vite + Tailwind CSS
    src/
      App.jsx                Router setup
      api.js                 API client (proxied via Vite to /api → localhost:8000)
      pages/
        Landing.jsx          Home/landing page + footer links (Business Portal / Admin)
        Dashboard.jsx        Form + results + AI chat
        CompanyLogin.jsx     Business portal login (/business)
        CompanyDashboard.jsx Bank statement upload → score (/business/dashboard)
        Admin.jsx            Superadmin panel (model info, CSV retrain, company mgmt)
      components/
        Form.jsx             6-step progressive form
        ScoreDisplay.jsx     Score gauge, factors, tips
        AIChat.jsx           Template-based AI chat
        BankStatementUpload.jsx  Bank statement CSV uploader (individual flow)
  backend/                   FastAPI Python backend
    main.py                  API routes (individual + business + admin)
    model.py                 Logistic Regression on lending_data.csv (7 features)
    utils.py                 Factors, tips, explanations, AI responses
    database.py              SQLite — scores, companies, sessions, business_checks
    auth.py                  HTTP Basic Auth for superadmin
    statement_parser.py      Ghana bank statement CSV parser (6 layouts)
Credit_Risk/
  Resources/lending_data.csv  Training data (77,536 rows, original notebook format)
```

## Model Features (original notebook: X = df.drop(columns='loan_status'))

loan_size, interest_rate, borrower_income, debt_to_income, num_of_accounts, derogatory_marks, total_debt

- Upload CSVs use these 7 columns + loan_status directly (no translation)
- Individual form inputs are translated to these features for scoring
- Training data: lending_data.csv (77K rows) — retrain appends to this file

## Workflows

- **Start application** – React Vite frontend on port 5000
- **Backend API** – FastAPI on localhost:8000; retrains model on first startup if no model.pkl

Frontend proxies `/api/*` → `localhost:8000` via Vite config.

## API Endpoints

**Individual**
- `POST /predict` – calculate score (300–850), band, factors, tips
- `POST /explain` – plain-English explanation + top suggestions
- `POST /chat` – template-based AI assistant responses
- `GET /stats` – aggregate stats from recent checks

**Business Portal**
- `POST /business/login` – company email+password → session token
- `POST /business/logout` – invalidate token
- `GET /business/me` – current company info
- `POST /business/check-credit` – upload bank statement → instant score
- `GET /business/history` – company's past credit checks

**Admin** (HTTP Basic Auth: superadmin)
- `GET /admin/model-info` – model stats and feature schema
- `POST /admin/retrain` – upload CSV → append + retrain
- `POST /admin/companies` – create company account
- `GET /admin/companies` – list all companies

## Score Bands

- 300–579 → Poor
- 580–669 → Fair
- 670–739 → Good
- 740+ → Excellent

## Key Notes

- Individual users: no sign-up, anonymous UUIDs, no PII stored
- Business users: email + password auth, session tokens in DB, audit trail of checks
- Superadmin credentials: set via ADMIN_USERNAME / ADMIN_PASSWORD env vars
- Frontend uses Vite's dev proxy to route API calls; in production both services run together
- Disclaimer shown on results: "This is not an official credit score"
