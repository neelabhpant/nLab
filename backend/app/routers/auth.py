import logging

import requests as http_requests
from google.oauth2 import id_token as google_id_token
from google.auth.transport.requests import Request as GoogleAuthRequest
from fastapi import APIRouter, HTTPException, Depends
from fastapi.requests import Request
from pydantic import BaseModel

from app.config import get_settings
from app.services.auth import (
    create_token,
    get_allowed_emails,
    get_current_user,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"


class GoogleAuthRequest_(BaseModel):
    """Request body for Google OAuth code exchange."""

    code: str
    redirect_uri: str


class AuthResponse(BaseModel):
    """Response after successful authentication."""

    token: str
    user: dict


@router.post("/google")
async def google_auth(body: GoogleAuthRequest_) -> dict:
    """Exchange a Google authorization code for a JWT."""
    settings = get_settings()

    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")

    token_response = http_requests.post(
        GOOGLE_TOKEN_URL,
        data={
            "code": body.code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": body.redirect_uri,
            "grant_type": "authorization_code",
        },
        timeout=10,
    )

    if token_response.status_code != 200:
        logger.error("Google token exchange failed: %s", token_response.text)
        raise HTTPException(status_code=401, detail="Failed to authenticate with Google")

    token_data = token_response.json()
    raw_id_token = token_data.get("id_token")
    if not raw_id_token:
        raise HTTPException(status_code=401, detail="No id_token in Google response")

    try:
        user_info = google_id_token.verify_oauth2_token(
            raw_id_token,
            GoogleAuthRequest(),
            settings.google_client_id,
        )
    except ValueError as exc:
        logger.error("Google id_token verification failed: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid Google token")

    email = user_info.get("email", "").lower()
    allowed = get_allowed_emails()
    if allowed is not None and email not in allowed:
        raise HTTPException(status_code=403, detail="Email not authorized")

    jwt_token = create_token(user_info)

    return {
        "token": jwt_token,
        "user": {
            "email": email,
            "name": user_info.get("name", ""),
            "picture": user_info.get("picture", ""),
        },
    }


@router.get("/me")
async def me(user: dict = Depends(get_current_user)) -> dict:
    """Return the current authenticated user."""
    return user
