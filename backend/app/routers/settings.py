"""User settings endpoints."""

from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.llm import (
    PROVIDER_MODELS,
    get_user_settings,
    save_user_settings,
)

router = APIRouter(tags=["settings"])


class SettingsResponse(BaseModel):
    """Current LLM settings."""

    provider: str
    openai_model: str
    anthropic_model: str
    groq_model: str
    has_openai_key: bool
    has_anthropic_key: bool
    has_groq_key: bool
    provider_models: dict[str, list[str]]


class SettingsUpdate(BaseModel):
    """Partial settings update payload."""

    provider: Optional[str] = None
    openai_model: Optional[str] = None
    anthropic_model: Optional[str] = None
    groq_model: Optional[str] = None
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    groq_api_key: Optional[str] = None


@router.get("/settings", response_model=SettingsResponse)
async def read_settings() -> SettingsResponse:
    """Return current LLM settings (keys masked)."""
    s = get_user_settings()
    return SettingsResponse(
        provider=s["provider"],
        openai_model=s["openai_model"],
        anthropic_model=s["anthropic_model"],
        groq_model=s["groq_model"],
        has_openai_key=bool(s["openai_api_key"]),
        has_anthropic_key=bool(s["anthropic_api_key"]),
        has_groq_key=bool(s["groq_api_key"]),
        provider_models=PROVIDER_MODELS,
    )


@router.post("/settings", response_model=SettingsResponse)
async def update_settings(body: SettingsUpdate) -> SettingsResponse:
    """Update LLM settings and persist to disk."""
    current = get_user_settings()

    updates: dict = {}
    if body.provider is not None:
        updates["provider"] = body.provider
    if body.openai_model is not None:
        updates["openai_model"] = body.openai_model
    if body.anthropic_model is not None:
        updates["anthropic_model"] = body.anthropic_model
    if body.groq_model is not None:
        updates["groq_model"] = body.groq_model
    if body.openai_api_key is not None:
        updates["openai_api_key"] = body.openai_api_key
    if body.anthropic_api_key is not None:
        updates["anthropic_api_key"] = body.anthropic_api_key
    if body.groq_api_key is not None:
        updates["groq_api_key"] = body.groq_api_key

    merged = {**current, **updates}
    save_user_settings(merged)

    refreshed = get_user_settings()
    return SettingsResponse(
        provider=refreshed["provider"],
        openai_model=refreshed["openai_model"],
        anthropic_model=refreshed["anthropic_model"],
        groq_model=refreshed["groq_model"],
        has_openai_key=bool(refreshed["openai_api_key"]),
        has_anthropic_key=bool(refreshed["anthropic_api_key"]),
        has_groq_key=bool(refreshed["groq_api_key"]),
        provider_models=PROVIDER_MODELS,
    )
