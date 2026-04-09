import os
import secrets
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials

security = HTTPBasic()

ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "superadmin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")


def verify_admin(credentials: HTTPBasicCredentials = Depends(security)):
    if not ADMIN_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin password not configured. Set the ADMIN_PASSWORD environment variable.",
        )

    username_ok = secrets.compare_digest(
        credentials.username.encode(), ADMIN_USERNAME.encode()
    )
    password_ok = secrets.compare_digest(
        credentials.password.encode(), ADMIN_PASSWORD.encode()
    )

    if not (username_ok and password_ok):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username
