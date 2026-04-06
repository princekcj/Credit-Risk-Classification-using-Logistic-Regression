# ClearScore

A full-stack fintech web app that gives unbanked users in Ghana a credit score (300–850) derived from alternative financial data — income, expenses, rent consistency, mobile money transactions, and savings.

**New: Business Portal** — microfinance companies log in and upload a client's 3-month bank statement CSV to get an instant credit score with factors, tips, and a full check history.

Built with **React 18 + FastAPI**, powered by a **Logistic Regression model** trained on 77,536 historical lending records.

---

## Pages

| Route                 | Description                                              |
|-----------------------|----------------------------------------------------------|
| `/`                   | Animated landing page                                    |
| `/dashboard`          | 7-step form → score result → AI chat                    |
| `/business`           | Business portal login                                    |
| `/business/dashboard` | Upload client bank statement → instant credit score      |
| `/admin`              | Superadmin panel — model stats, CSV retrain, company accounts |

---

## Project Structure

```
app/
  frontend/                    React 18 + Vite + Tailwind CSS
    src/
      App.jsx                  Route definitions
      api.js                   Axios API client
      pages/
        Landing.jsx            Animated landing page with footer portal links
        Dashboard.jsx          Multi-step form + results + AI chat
        CompanyLogin.jsx       Business portal login (/business)
        CompanyDashboard.jsx   Bank statement upload → score (/business/dashboard)
        Admin.jsx              Superadmin panel (model, CSV retrain, company mgmt)
      components/
        Form.jsx               7-step progressive form (includes region)
        ScoreDisplay.jsx       Score gauge, factors, tips
        AIChat.jsx             Rule-based AI chat assistant
        BankStatementUpload.jsx Bank statement CSV uploader (individual flow)
  backend/                     Python 3.11 + FastAPI
    main.py                    All API routes + static file serving
    auth.py                    HTTP Basic Auth for superadmin endpoints
    model.py                   Logistic Regression scoring model
    utils.py                   Factors, tips, explanations, AI responses
    database.py                SQLite — scores, companies, sessions, business_checks
    statement_parser.py        Ghana bank CSV parser (GCB, Ecobank, Stanbic, StanChart, Fidelity, generic)
    momo.py                    MTN MoMo OAuth integration
    model.pkl                  Trained model (auto-generated at startup)
    scores.db                  SQLite database (auto-generated)
Credit_Risk/
  Resources/
    lending_data.csv           Training dataset (77,536 rows)
  credit_risk_classification.ipynb  Original Jupyter notebook
package.json                   Root build script (deployment)
```

---

## Prerequisites

- **Python 3.11+**
- **Node.js 18+** and **npm**

---

## Running Locally

You need two terminals — one for the backend and one for the frontend.

### 1. Backend (FastAPI)

```bash
cd app/backend
pip install fastapi uvicorn[standard] scikit-learn imbalanced-learn pandas numpy
uvicorn main:app --host localhost --port 8000 --reload
```

The API will be available at `http://localhost:8000`.

On first start the model is trained automatically on `lending_data.csv` (~30 seconds) and saved to `model.pkl`. Subsequent starts load the pickle instantly.

```bash
curl http://localhost:8000/health
# {"status":"healthy"}
```

### 2. Frontend (React + Vite)

```bash
cd app/frontend
npm install
npm run dev
```

Vite proxies all `/api/*` requests to `http://localhost:8000` automatically.

---

## Environment Variables

| Variable         | Description                          | Default       |
|------------------|--------------------------------------|---------------|
| `ADMIN_USERNAME` | Superadmin login username            | `superadmin`  |
| `ADMIN_PASSWORD` | Superadmin login password            | *(required)*  |

```bash
export ADMIN_USERNAME=superadmin
export ADMIN_PASSWORD=your-password
```

---

## Building for Production

```bash
npm run build       # compiles React → app/frontend/dist/
```

Serve backend + frontend from one process:

```bash
cd app/backend
gunicorn main:app -w 1 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:5000 --timeout 120
```

The backend serves `dist/` and handles SPA routing — no separate web server needed.

---

## API Reference

### Individual Scoring

#### `POST /predict`

**Request:**
```json
{
  "income": 2500,
  "employment_type": "employed",
  "expenses": 900,
  "rent_consistency": 0.9,
  "mobile_transactions": 15,
  "savings": 500,
  "region": "greater_accra"
}
```

`employment_type`: `employed` | `part_time` | `self_employed` | `unemployed` | `student`

`region` (all 16 Ghana regions): `greater_accra`, `ashanti`, `western`, `western_north`, `central`, `eastern`, `volta`, `oti`, `bono`, `bono_east`, `ahafo`, `northern`, `savannah`, `north_east`, `upper_east`, `upper_west`

**Response:**
```json
{
  "score": 724,
  "band": "Good",
  "factors": [
    { "name": "Low debt-to-income ratio", "impact": "+" },
    { "name": "Consistent rent payments", "impact": "+" }
  ],
  "tips": ["Build up your savings buffer to strengthen your profile."],
  "session_id": "uuid-string",
  "model_prediction": "healthy",
  "confidence": 86.2
}
```

#### `POST /parse/bank-statement`

Upload a CSV bank statement export (max 5 MB). Returns pre-fill values for the scoring form.

Supported banks: **GCB, Ecobank, Stanbic, Standard Chartered, Fidelity**, and a generic auto-detect fallback.

**Request:** `multipart/form-data` with field `file` (`.csv`)

**Response:**
```json
{
  "income": 2500.00,
  "expenses": 975.00,
  "rent_consistency": 1.0,
  "mobile_transactions": 3,
  "savings": 1067.50,
  "employment_type": "employed",
  "months_detected": 3,
  "bank_layout": "gcb",
  "transactions_found": 18,
  "summary": "Parsed 18 transactions over 3 months...",
  "warnings": []
}
```

#### `POST /explain`

Plain-English explanation. Same body as `/predict` plus `"score": 724`.

#### `POST /chat`

AI chat assistant. Same body as `/predict` plus `"score": 724` and `"message": "Why is my score low?"`.

#### `GET /stats`

Aggregate statistics from the last 20 checks.

#### `GET /health`

Returns `{"status": "healthy"}`.

---

### Business Portal

Companies must authenticate first. The admin creates company accounts via the admin panel or API.

#### `POST /business/login`

**Request:**
```json
{ "email": "company@example.com", "password": "their-password" }
```

**Response:**
```json
{ "token": "...", "name": "Accra MFI Ltd", "email": "company@example.com" }
```

Include the token in subsequent requests: `Authorization: Bearer <token>`

#### `POST /business/check-credit`

Upload a client's bank statement CSV (max 10 MB). The parser extracts income, expenses, payment consistency, and mobile activity, feeds them through the credit model, and returns a full score report.

**Request:** `multipart/form-data` with:
- `file` — CSV bank statement (required)
- `client_ref` — client identifier e.g. `CUST-00123` (optional)

**Response:**
```json
{
  "score": 681,
  "band": "Good",
  "model_prediction": "healthy",
  "confidence": 79.4,
  "months_analysed": 3,
  "bank_layout": "ecobank",
  "income": 3200.0,
  "expenses": 1400.0,
  "factors": [
    { "name": "Strong monthly income", "impact": "+" }
  ],
  "tips": ["Encourage regular savings contributions."],
  "warnings": []
}
```

#### `GET /business/history`

Returns all past credit checks by this company (most recent first).

```json
{
  "checks": [
    { "id": 1, "client_ref": "CUST-001", "score": 681, "band": "Good", "months": 3, "timestamp": "2025-04-06T10:30:00" }
  ],
  "total": 1
}
```

#### `GET /business/me`

Returns the authenticated company's name and email.

#### `POST /business/logout`

Invalidates the current session token.

---

### Admin Endpoints (HTTP Basic Auth)

All admin endpoints require: `Authorization: Basic <base64(username:password)>`

| Method | Path                  | Description                                          |
|--------|-----------------------|------------------------------------------------------|
| GET    | `/admin/model-info`   | Model metrics, training stats, and upload schema     |
| POST   | `/admin/retrain`      | Upload CSV → append to training data → retrain       |
| POST   | `/admin/companies`    | Create a new company account `{name, email, password}` |
| GET    | `/admin/companies`    | List all registered companies                         |

---

### MTN MoMo (optional)

| Method | Path              | Description                                              |
|--------|-------------------|----------------------------------------------------------|
| GET    | `/momo/auth-url`  | Returns OAuth2 authorisation URL                         |
| POST   | `/momo/callback`  | Exchange auth code for account data                      |

Without `MOMO_SUBSCRIPTION_KEY`, all MoMo endpoints operate in **sandbox mode** with mock data.

| Variable               | Description                                          |
|------------------------|------------------------------------------------------|
| `MOMO_SUBSCRIPTION_KEY`| MTN MoMo API subscription key (production)           |
| `MOMO_API_KEY`         | MTN MoMo API user key (production)                   |
| `MOMO_API_SECRET`      | MTN MoMo API user secret (production)                |
| `MOMO_REDIRECT_URI`    | OAuth2 callback URL (default: localhost:5000)         |
| `MOMO_ENVIRONMENT`     | MTN environment name (default: `sandbox`)            |

---

## Score Bands

| Range   | Band      |
|---------|-----------|
| 300–579 | Poor      |
| 580–669 | Fair      |
| 670–739 | Good      |
| 740–850 | Excellent |

Score formula: `score = 300 + round(P(healthy) × 550)`

---

## Scoring Model

### Algorithm

The score is produced by a Logistic Regression pipeline:

1. **`RandomOverSampler`** balances training classes (`random_state=1`) to prevent bias toward the majority class
2. **`LogisticRegression`** predicts `P(healthy borrower)` — the probability this person is a low-risk borrower
3. **Score** = `300 + round(P(healthy) × 550)` — maps the 0–1 probability onto the 300–850 scale

The model is saved to `model.pkl` on first run (or after retraining). If the pickle is missing or was trained on a different feature set, it retrains automatically on startup.

### Features

The model uses exactly the same 7 features as the original notebook (`X = df.drop(columns='loan_status')`):

| Feature            | Type  | What it represents                                         |
|--------------------|-------|------------------------------------------------------------|
| `loan_size`        | float | Loan amount                                                |
| `interest_rate`    | float | Loan interest rate (%)                                     |
| `borrower_income`  | float | Annual borrower income                                     |
| `debt_to_income`   | float | Total debt obligations ÷ income (e.g. 0.35 = 35%)         |
| `num_of_accounts`  | int   | Number of open financial accounts                          |
| `derogatory_marks` | int   | Count of negative credit events (missed payments, defaults)|
| `total_debt`       | float | Total outstanding debt                                     |

**Individual form inputs are translated to these features:**

| Form input           | Model feature     | How                                               |
|----------------------|-------------------|---------------------------------------------------|
| `income` (monthly)   | `borrower_income` | × 12 (annualise)                                  |
| `expenses / income`  | `debt_to_income`  | monthly expenses ÷ monthly income                 |
| `mobile_transactions`| `num_of_accounts` | ÷ 3, rounded (≈ accounts per mobile service)      |
| `1 − rent_consistency` | `derogatory_marks` | × 5 (0 marks = perfect payer, 5 = never pays) |
| `expenses × 12`      | `total_debt`      | annual obligations proxy                          |
| representative       | `loan_size`       | income × 6 (6-month micro-loan proxy)             |
| representative       | `interest_rate`   | 12.5% (Ghana microfinance median)                 |

**Bank statement uploads (business portal):** parsed into the same form-input signals above, then translated identically.

**CSV uploads for retraining:** use the 7 feature columns directly — no translation needed.

### Training Data

`Credit_Risk/Resources/lending_data.csv` — **77,536 rows**, original US lending dataset, same format as the Jupyter notebook.

Current trained model accuracy: **99.49%** on a 25% hold-out test set.

---

## Retraining the Model

### Upload format

Your CSV must have **exactly these 8 columns** (in any order):

```
loan_size, interest_rate, borrower_income, debt_to_income, num_of_accounts, derogatory_marks, total_debt, loan_status
```

`loan_status`: `0` = healthy borrower · `1` = high-risk borrower

**Example:**
```
loan_size,interest_rate,borrower_income,debt_to_income,num_of_accounts,derogatory_marks,total_debt,loan_status
10700.0,7.672,52800,0.4318,5,1,22800,0
8400.0,6.692,43600,0.3119,3,0,13600,0
19600.0,11.089,64900,0.5624,11,2,36500,1
```

This matches the `lending_data.csv` header exactly — you can export data in this format and upload it without any conversion.

### Append vs. reset

New rows are **appended** to the existing `lending_data.csv` — the model grows cumulatively. Duplicate rows are removed automatically. To start fresh, delete `lending_data.csv` before uploading.

### How to retrain

**Via the admin panel** (recommended):
Visit `/admin`, log in, and use the Upload & Retrain section.

**Via API:**
```bash
curl -u superadmin:your-password \
  -F "file=@my_data.csv" \
  http://localhost:8000/admin/retrain
```

### Retraining tips

| Tip                | Details                                                                                             |
|--------------------|-----------------------------------------------------------------------------------------------------|
| Minimum size       | 50 rows — passes validation, minimal impact against 77K baseline                                    |
| Noticeable shift   | 500–2,000 rows — meaningful movement of the decision boundary                                       |
| High impact        | 5,000+ rows — measurable accuracy, precision, recall changes                                        |
| Class balance      | Aim for 65–75% healthy (0) and 25–35% high-risk (1). Both classes required or the upload is rejected |
| `debt_to_income`   | Express as a decimal ratio (e.g. `0.35`, not `35`)                                                  |
| `derogatory_marks` | Integer values (0, 1, 2, …)                                                                         |

---

## Business Portal — Setup Guide

1. **Admin creates company accounts**
   - Visit `/admin`, log in with superadmin credentials
   - Scroll to "Company Accounts" → fill in company name, email, and a password → click "Create Account"

2. **Company logs in**
   - Visit `/business`
   - Enter the email and password set by the admin

3. **Upload a client's bank statement**
   - In the dashboard, optionally enter a client reference (e.g. account number)
   - Drop or select the client's CSV bank statement export (last 3 months recommended)
   - Supported banks: **GCB, Ecobank, Stanbic, Standard Chartered, Fidelity**, and any generic CSV with debit/credit columns

4. **View the score**
   - Score, band, credit factors, and improvement tips are returned instantly
   - All checks are saved and visible in the history table below

---

## Privacy

- Individual users: no sign-up, no PII stored, sessions use anonymous UUIDs in `localStorage`
- Business users: company email and hashed password stored; client references and check history are tied to the company account only
- Disclaimer displayed on every result: *"This is not an official credit score"*
