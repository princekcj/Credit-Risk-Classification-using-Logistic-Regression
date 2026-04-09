"""
MTN MoMo OAuth integration.
Without MOMO_SUBSCRIPTION_KEY this module operates in sandbox/mock mode.
"""

import os
import uuid

MOMO_SUBSCRIPTION_KEY = os.environ.get("MOMO_SUBSCRIPTION_KEY", "")
MOMO_API_KEY          = os.environ.get("MOMO_API_KEY", "")
MOMO_API_SECRET       = os.environ.get("MOMO_API_SECRET", "")
MOMO_REDIRECT_URI     = os.environ.get("MOMO_REDIRECT_URI", "http://localhost:5000/momo/callback")
MOMO_ENVIRONMENT      = os.environ.get("MOMO_ENVIRONMENT", "sandbox")

MOMO_BASE_URL = (
    "https://proxy.momoapi.mtn.com"
    if MOMO_ENVIRONMENT == "production"
    else "https://sandbox.momodeveloper.mtn.com"
)


def get_auth_url(redirect_uri: str | None = None):
    """Return an OAuth2 authorisation URL or a mock URL in sandbox mode."""
    if not MOMO_SUBSCRIPTION_KEY:
        state = str(uuid.uuid4())
        return {
            "url": f"/momo/callback?code=mock_code&state={state}",
            "state": state,
            "sandbox": True,
            "message": "MoMo sandbox mode — no real credentials configured.",
        }

    state = str(uuid.uuid4())
    redir = redirect_uri or MOMO_REDIRECT_URI
    url = (
        f"{MOMO_BASE_URL}/oauth2/token"
        f"?response_type=code"
        f"&client_id={MOMO_API_KEY}"
        f"&redirect_uri={redir}"
        f"&state={state}"
        f"&scope=profile"
    )
    return {"url": url, "state": state, "sandbox": False}


def handle_callback(code: str, state: str):
    """Exchange an auth code for account data (returns mock data in sandbox mode)."""
    if not MOMO_SUBSCRIPTION_KEY or code == "mock_code":
        return {
            "success": True,
            "sandbox": True,
            "mobile_transactions": 12,
            "account_balance": 850.0,
            "message": "Mock MoMo data returned (sandbox mode).",
        }

    try:
        import requests

        resp = requests.post(
            f"{MOMO_BASE_URL}/oauth2/token",
            json={"grant_type": "authorization_code", "code": code},
            headers={
                "Ocp-Apim-Subscription-Key": MOMO_SUBSCRIPTION_KEY,
                "Authorization": f"Basic {MOMO_API_KEY}:{MOMO_API_SECRET}",
                "X-Target-Environment": MOMO_ENVIRONMENT,
            },
            timeout=15,
        )
        resp.raise_for_status()
        token_data = resp.json()
        return {
            "success": True,
            "sandbox": False,
            "access_token": token_data.get("access_token"),
            "mobile_transactions": 0,
        }
    except Exception as exc:
        return {"success": False, "error": str(exc)}
