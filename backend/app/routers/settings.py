"""User settings endpoints."""

from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.llm import (
    PROVIDER_MODELS,
    get_user_settings,
    save_user_settings,
)
from app.services.newsletter.model_config import GENERATION_MODEL_CHOICES

router = APIRouter(tags=["settings"])

VOICE_CHECK_MODES = ["manual", "auto_save", "auto_preview"]


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
    newsletter_generation_model: str
    generation_model_choices: list[str]
    voice_check_mode: str
    voice_check_modes: list[str]


class SettingsUpdate(BaseModel):
    """Partial settings update payload."""

    provider: Optional[str] = None
    openai_model: Optional[str] = None
    anthropic_model: Optional[str] = None
    groq_model: Optional[str] = None
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    groq_api_key: Optional[str] = None
    newsletter_generation_model: Optional[str] = None
    voice_check_mode: Optional[str] = None


def _to_response(s: dict) -> SettingsResponse:
    return SettingsResponse(
        provider=s["provider"],
        openai_model=s["openai_model"],
        anthropic_model=s["anthropic_model"],
        groq_model=s["groq_model"],
        has_openai_key=bool(s["openai_api_key"]),
        has_anthropic_key=bool(s["anthropic_api_key"]),
        has_groq_key=bool(s["groq_api_key"]),
        provider_models=PROVIDER_MODELS,
        newsletter_generation_model=s["newsletter_generation_model"],
        generation_model_choices=GENERATION_MODEL_CHOICES,
        voice_check_mode=s["voice_check_mode"],
        voice_check_modes=VOICE_CHECK_MODES,
    )


@router.get("/settings", response_model=SettingsResponse)
async def read_settings() -> SettingsResponse:
    """Return current LLM settings (keys masked)."""
    return _to_response(get_user_settings())


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
    if body.newsletter_generation_model is not None:
        updates["newsletter_generation_model"] = body.newsletter_generation_model
    if body.voice_check_mode is not None:
        updates["voice_check_mode"] = body.voice_check_mode

    merged = {**current, **updates}
    save_user_settings(merged)

    return _to_response(get_user_settings())
