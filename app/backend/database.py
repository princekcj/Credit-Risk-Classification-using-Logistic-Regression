import sqlite3
import json
import uuid
import hashlib
import os
import secrets
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), "scores.db")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS scores (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            input_data TEXT NOT NULL,
            score      INTEGER NOT NULL,
            band       TEXT NOT NULL,
            timestamp  TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS companies (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            name          TEXT NOT NULL,
            email         TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at    TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS company_sessions (
            token      TEXT PRIMARY KEY,
            company_id INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (company_id) REFERENCES companies(id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS business_checks (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id   INTEGER NOT NULL,
            client_ref   TEXT,
            score        INTEGER NOT NULL,
            band         TEXT NOT NULL,
            months       INTEGER,
            parsed_data  TEXT,
            timestamp    TEXT NOT NULL,
            FOREIGN KEY (company_id) REFERENCES companies(id)
        )
    """)

    conn.commit()
    conn.close()


# ── password helpers ────────────────────────────────────────────────────────────

def _hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000).hex()
    return f"{salt}${hashed}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        salt, hashed = stored.split("$", 1)
        check = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000).hex()
        return secrets.compare_digest(check, hashed)
    except Exception:
        return False


# ── individual score storage ────────────────────────────────────────────────────

def save_score(session_id: str, input_data: dict, score: int, band: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO scores (session_id, input_data, score, band, timestamp)
        VALUES (?, ?, ?, ?, ?)
    """, (session_id, json.dumps(input_data), score, band, datetime.utcnow().isoformat()))
    conn.commit()
    conn.close()


def get_recent_scores(limit: int = 10):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT session_id, score, band, timestamp FROM scores
        ORDER BY timestamp DESC LIMIT ?
    """, (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── company management ──────────────────────────────────────────────────────────

def create_company(name: str, email: str, password: str) -> dict:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO companies (name, email, password_hash, created_at)
            VALUES (?, ?, ?, ?)
        """, (name, email.lower(), _hash_password(password), datetime.utcnow().isoformat()))
        conn.commit()
        company_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        conn.close()
        return None  # email already registered
    conn.close()
    return {"id": company_id, "name": name, "email": email.lower()}


def get_company_by_email(email: str) -> dict | None:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM companies WHERE email = ?", (email.lower(),))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def list_companies() -> list:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, email, created_at FROM companies ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def authenticate_company(email: str, password: str) -> dict | None:
    company = get_company_by_email(email)
    if not company:
        return None
    if not _verify_password(password, company["password_hash"]):
        return None
    return {"id": company["id"], "name": company["name"], "email": company["email"]}


# ── company sessions ────────────────────────────────────────────────────────────

def create_company_session(company_id: int) -> str:
    token = secrets.token_urlsafe(32)
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO company_sessions (token, company_id, created_at)
        VALUES (?, ?, ?)
    """, (token, company_id, datetime.utcnow().isoformat()))
    conn.commit()
    conn.close()
    return token


def get_company_by_token(token: str) -> dict | None:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT c.id, c.name, c.email
        FROM company_sessions s
        JOIN companies c ON c.id = s.company_id
        WHERE s.token = ?
    """, (token,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def delete_company_session(token: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM company_sessions WHERE token = ?", (token,))
    conn.commit()
    conn.close()


# ── business credit checks ──────────────────────────────────────────────────────

def save_business_check(company_id: int, client_ref: str, score: int, band: str,
                         months: int, parsed_data: dict):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO business_checks (company_id, client_ref, score, band, months, parsed_data, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (company_id, client_ref or "", score, band, months,
          json.dumps(parsed_data), datetime.utcnow().isoformat()))
    conn.commit()
    conn.close()


def get_business_checks(company_id: int, limit: int = 50) -> list:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, client_ref, score, band, months, timestamp
        FROM business_checks
        WHERE company_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
    """, (company_id, limit))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]
