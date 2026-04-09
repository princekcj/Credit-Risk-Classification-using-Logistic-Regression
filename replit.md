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
- React Router DOM v6
- Axios

**Backend:**
- Python 3.12 + FastAPI
- Uvicorn / Gunicorn (production)
- SQLite (synchronous sqlite3)

## Project Structure

```
app/
  frontend/                  React + Vite + Tailwind CSS
    package.json             npm dependencies
    vite.config.js           Vite config (host 0.0.0.0:5000, proxy /api → localhost:8000)
    index.html               HTML entry point
    src/
      main.jsx               React entry
      index.css              Tailwind CSS import
      App.jsx                Router setup
      api.js                 API client (proxied via Vite to /api → localhost:8000)
      pages/
        Landing.jsx          Home/landing page + footer links (Business Portal / Admin)
        Dashboard.jsx        Form + results + AI chat
        TestForm.jsx         Redirect stub → /dashboard
        CompanyLogin.jsx     Business portal login (/business)
        CompanyDashboard.jsx Bank statement upload → score (/business/dashboard)
        Admin.jsx            Superadmin panel (model info, CSV retrain, company mgmt)
  backend/                   FastAPI Python backend
    main.py                  API routes (individual + business + admin) + SPA static serving
    model.py                 Logistic Regression on lending_data.csv (7 features)
    utils.py                 Factors, tips, explanations, AI responses
    database.py              SQLite — scores, companies, sessions, business_checks
    auth.py                  HTTP Basic Auth for superadmin
    statement_parser.py      Ghana bank statement CSV parser (6 layouts)
    momo.py                  MTN MoMo OAuth integration (sandbox/mock mode by default)
Credit_Risk/
  Resources/lending_data.csv  Training data (77,536 rows, original notebook format)
```

## Workflows

- **Start application** – React Vite frontend on port 5000 (webview)
  - Command: `cd app/frontend && npm run dev`
- **Backend API** – FastAPI on localhost:8000 (console)
  - Command: `cd app/backend && uvicorn main:app --host localhost --port 8000`

Frontend proxies `/api/*` → `localhost:8000` via Vite config.

## Environment Variables

| Variable         | Description                          | Default       |
|------------------|--------------------------------------|---------------|
| `ADMIN_USERNAME` | Superadmin login username            | `superadmin`  |
| `ADMIN_PASSWORD` | Superadmin login password (required) | *(required)*  |
| `MOMO_SUBSCRIPTION_KEY` | MTN MoMo API key (optional) | sandbox mode  |

## API Endpoints

**Individual**
- `POST /predict` – calculate score (300–850), band, factors, tips
- `POST /explain` – plain-English explanation + top suggestions
- `POST /chat` – template-based AI assistant responses
- `GET /stats` – aggregate stats from recent checks
- `POST /parse/bank-statement` – parse bank CSV and extract financial signals

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

## Deployment

Production: autoscale deployment
- Build: `cd app/frontend && npm install && npm run build`
- Run: `cd app/backend && gunicorn main:app -w 1 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:5000 --timeout 120`

In production, the FastAPI backend serves the compiled React SPA from `app/frontend/dist/`.

## Key Notes

- Individual users: no sign-up, anonymous UUIDs, no PII stored
- Business users: email + password auth, session tokens in DB, audit trail of checks
- Superadmin credentials: set via ADMIN_USERNAME / ADMIN_PASSWORD env vars
- Frontend uses Vite's dev proxy to route API calls; in production both services run from one process
- Disclaimer shown on results: "This is not an official credit score"
- Model trains automatically on first startup from lending_data.csv (~30s); cached as model.pkl
