import os
import logging
import secrets
from datetime import datetime, timezone, timedelta

import jwt
from fastapi import Request, HTTPException

logger = logging.getLogger(__name__)

_jwt_secret: str | None = None


def _get_jwt_secret() -> str:
    """Return the JWT secret, generating a random one if not configured."""
    global _jwt_secret
    if _jwt_secret is not None:
        return _jwt_secret

    secret = os.getenv("JWT_SECRET", "")
    if not secret:
        secret = secrets.token_hex(32)
        logger.warning("JWT_SECRET not set — using a random secret (tokens won't survive restarts)")
    _jwt_secret = secret
    return _jwt_secret


TOKEN_EXPIRY_DAYS = 7


def create_token(user_info: dict) -> str:
    """Create a JWT for the given user info."""
    payload = {
        "sub": user_info["sub"],
        "email": user_info["email"],
        "name": user_info.get("name", ""),
        "picture": user_info.get("picture", ""),
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRY_DAYS),
    }
    return jwt.encode(payload, _get_jwt_secret(), algorithm="HS256")


def verify_token(token: str) -> dict | None:
    """Verify and decode a JWT. Returns payload dict or None if invalid."""
    try:
        payload = jwt.decode(token, _get_jwt_secret(), algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_allowed_emails() -> set[str] | None:
    """Return the set of allowed emails, or None if no whitelist is configured."""
    raw = os.getenv("ALLOWED_EMAILS", "")
    if not raw.strip():
        return None
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


def _extract_token(request: Request) -> str | None:
    """Extract token from Authorization header or query param."""
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return request.query_params.get("token")


async def get_current_user(request: Request) -> dict:
    """FastAPI dependency — returns user info from JWT or raises 401."""
    token = _extract_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return {
        "sub": payload["sub"],
        "email": payload["email"],
        "name": payload.get("name", ""),
        "picture": payload.get("picture", ""),
    }
