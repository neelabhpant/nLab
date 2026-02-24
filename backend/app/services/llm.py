"""Centralised LLM builder that respects user settings."""

import json
import logging
from pathlib import Path

from crewai import LLM

from app.config import get_settings

logger = logging.getLogger(__name__)

SETTINGS_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "user_settings.json"

PROVIDER_MODELS: dict[str, list[str]] = {
    "openai": ["gpt-5.2", "gpt-5", "gpt-5-mini", "gpt-4o", "gpt-4o-mini"],
    "anthropic": [
        "claude-sonnet-4-6",
        "claude-opus-4-6",
        "claude-sonnet-4-5",
        "claude-opus-4-5",
        "claude-haiku-4-5",
    ],
    "groq": [
        "llama-3.3-70b-versatile",
        "qwen/qwen-3-32b",
        "moonshotai/kimi-k2-instruct-0905",
    ],
}


def _load_user_settings() -> dict:
    """Load persisted user settings from disk."""
    if SETTINGS_PATH.exists():
        try:
            return json.loads(SETTINGS_PATH.read_text())
        except (json.JSONDecodeError, OSError):
            logger.warning("Failed to read user settings, using defaults")
    return {}


def save_user_settings(data: dict) -> None:
    """Persist user settings to disk."""
    SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    SETTINGS_PATH.write_text(json.dumps(data, indent=2))


def get_user_settings() -> dict:
    """Return merged settings: user overrides on top of env defaults."""
    env = get_settings()
    user = _load_user_settings()
    return {
        "provider": user.get("provider", env.default_llm_provider),
        "openai_model": user.get("openai_model", env.openai_model),
        "anthropic_model": user.get("anthropic_model", env.anthropic_model),
        "groq_model": user.get("groq_model", env.groq_model),
        "openai_api_key": user.get("openai_api_key") or env.openai_api_key,
        "anthropic_api_key": user.get("anthropic_api_key") or env.anthropic_api_key,
        "groq_api_key": user.get("groq_api_key") or env.groq_api_key,
    }


_NO_TEMPERATURE_MODELS = {"gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-5.2"}


def get_llm() -> LLM:
    """Build a CrewAI LLM using current user settings."""
    s = get_user_settings()
    provider = s["provider"]

    if provider == "anthropic":
        return LLM(
            model=f"anthropic/{s['anthropic_model']}",
            api_key=s["anthropic_api_key"],
            temperature=0.3,
        )

    if provider == "groq":
        model_name = s["groq_model"]
        if not model_name.startswith("groq/"):
            model_name = f"groq/{model_name}"
        return LLM(
            model=model_name,
            api_key=s["groq_api_key"],
            temperature=0.3,
        )

    model_name = s["openai_model"]
    kwargs: dict = {
        "model": f"openai/{model_name}",
        "api_key": s["openai_api_key"],
    }
    if model_name not in _NO_TEMPERATURE_MODELS:
        kwargs["temperature"] = 0.3
    return LLM(**kwargs)
