import os
import secrets
from fastapi import Depends, HTTPException, Header, status

ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "superadmin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")

_admin_sessions: set[str] = set()


def create_admin_session() -> str:
    token = secrets.token_urlsafe(32)
    _admin_sessions.add(token)
    return token


def revoke_admin_session(token: str):
    _admin_sessions.discard(token)


def verify_admin(x_admin_token: str = Header(default=None)):
    if not x_admin_token or x_admin_token not in _admin_sessions:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin authentication required.",
        )
    return x_admin_token


def check_admin_credentials(username: str, password: str) -> bool:
    if not ADMIN_PASSWORD:
        return False
    username_ok = secrets.compare_digest(username.encode(), ADMIN_USERNAME.encode())
    password_ok = secrets.compare_digest(password.encode(), ADMIN_PASSWORD.encode())
    return username_ok and password_ok
