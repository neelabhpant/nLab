"""NewsletterLLMClient — dedicated Anthropic client for newsletter generation.

Sidesteps the CrewAI abstraction in app/services/llm.py because the composer
talks to Anthropic directly: one user message, one assistant response, no
tools, no agent loop. Forces Opus 4.7 for generation, Haiku for voice checks,
and falls back to the user's configured Anthropic model if Opus is rejected.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Optional

from anthropic import APIError, APIStatusError, AsyncAnthropic, BadRequestError, NotFoundError

from app.services.llm import get_user_settings
from app.services.newsletter.model_config import (
    GENERATION_MODEL,
    LLM_TIMEOUT_SECONDS,
    MAX_TOKENS_GENERATION,
    MAX_TOKENS_VOICE_CHECK,
    TEMPERATURE_GENERATION,
    TEMPERATURE_VOICE_CHECK,
    VOICE_CHECK_MODEL,
)

logger = logging.getLogger(__name__)


class AnthropicNotConfigured(RuntimeError):
    """Raised when the Anthropic API key is missing. Surfaced as 500 by the router."""


class GenerationTimeout(TimeoutError):
    """Raised when an LLM call exceeds LLM_TIMEOUT_SECONDS. Surfaced as 504."""


# Models that reject the `temperature` parameter. Add to this set as Anthropic
# rolls forward — currently Opus 4.7 is the first to drop it.
_MODELS_WITHOUT_TEMPERATURE: set[str] = {"claude-opus-4-7"}


def _model_drops_temperature(model: str) -> bool:
    """True if the given model rejects the `temperature` request parameter."""
    name = (model or "").lower()
    return any(name.startswith(prefix) for prefix in _MODELS_WITHOUT_TEMPERATURE)


def _is_model_not_found(exc: Exception) -> bool:
    """Detect the case where Anthropic rejects the requested model name."""
    if isinstance(exc, NotFoundError):
        return True
    if isinstance(exc, BadRequestError):
        text = (str(exc) or "").lower()
        return "model" in text and ("not" in text or "unknown" in text or "invalid" in text)
    return False


class NewsletterLLMClient:
    """One client per process. Reads the Anthropic key lazily so the user can
    update it in Settings without restarting the server."""

    def __init__(self) -> None:
        self._client: Optional[AsyncAnthropic] = None
        self._client_key: Optional[str] = None

    def _ensure_client(self) -> AsyncAnthropic:
        s = get_user_settings()
        api_key = s.get("anthropic_api_key") or ""
        if not api_key:
            raise AnthropicNotConfigured(
                "Newsletter generation requires an Anthropic API key. "
                "Add it in Settings or set ANTHROPIC_API_KEY."
            )
        if self._client is None or self._client_key != api_key:
            self._client = AsyncAnthropic(api_key=api_key)
            self._client_key = api_key
        return self._client

    @staticmethod
    def _user_anthropic_model() -> str:
        s = get_user_settings()
        return s.get("anthropic_model") or GENERATION_MODEL

    async def generate(self, prompt: str) -> str:
        """Call Opus 4.7 for content generation. Fall back to the user's
        configured Anthropic model if Opus is rejected."""
        client = self._ensure_client()
        primary = GENERATION_MODEL
        fallback = self._user_anthropic_model()

        try:
            text = await self._call(client, primary, prompt, MAX_TOKENS_GENERATION, TEMPERATURE_GENERATION)
            logger.info("newsletter.generate model=%s ok", primary)
            return text
        except Exception as exc:  # noqa: BLE001 — we want to discriminate below
            if _is_model_not_found(exc) and fallback and fallback != primary:
                logger.warning(
                    "newsletter.generate model=%s not available, falling back to %s",
                    primary,
                    fallback,
                )
                text = await self._call(
                    client, fallback, prompt, MAX_TOKENS_GENERATION, TEMPERATURE_GENERATION
                )
                logger.info("newsletter.generate model=%s ok (fallback)", fallback)
                return text
            raise

    async def voice_check(self, text: str, prompt_template: str) -> dict:
        """Call Haiku for voice verification. Returns parsed JSON dict."""
        client = self._ensure_client()
        prompt = prompt_template.replace("{user_input}", text)
        raw = await self._call(
            client, VOICE_CHECK_MODEL, prompt, MAX_TOKENS_VOICE_CHECK, TEMPERATURE_VOICE_CHECK
        )
        logger.info("newsletter.voice_check model=%s ok", VOICE_CHECK_MODEL)
        return _safe_json_load(raw)

    async def _call(
        self,
        client: AsyncAnthropic,
        model: str,
        prompt: str,
        max_tokens: int,
        temperature: float,
    ) -> str:
        start = time.perf_counter()
        kwargs: dict = {
            "model": model,
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": prompt}],
        }
        # Opus 4.7 (and presumably newer models) deprecated the `temperature`
        # parameter — Anthropic returns 400 invalid_request_error if we send
        # it. Older models still accept it; include conditionally.
        if not _model_drops_temperature(model):
            kwargs["temperature"] = temperature

        try:
            response = await asyncio.wait_for(
                client.messages.create(**kwargs),
                timeout=LLM_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError as exc:
            raise GenerationTimeout(
                f"Anthropic call exceeded {LLM_TIMEOUT_SECONDS}s (model={model})"
            ) from exc
        except (APIError, APIStatusError):
            raise
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        logger.info("newsletter.llm model=%s latency_ms=%d", model, elapsed_ms)
        # content is a list of blocks; we treat text-only responses as the v1 contract.
        if not response.content:
            return ""
        block = response.content[0]
        return getattr(block, "text", "") or ""


def _safe_json_load(raw: str) -> dict:
    """Tolerate ```json fences and stray prose around the JSON object."""
    s = (raw or "").strip()
    if s.startswith("```"):
        # strip fence start
        s = s.split("\n", 1)[1] if "\n" in s else s
        if s.endswith("```"):
            s = s[: -len("```")]
        s = s.strip()
    # Locate the outermost { ... }
    if "{" in s and "}" in s:
        first = s.index("{")
        last = s.rindex("}")
        s = s[first : last + 1]
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        logger.warning("voice_check returned unparseable JSON: %s", raw[:200])
        return {"violations": []}


# Module singleton — stateless apart from the cached client + key.
newsletter_llm_client = NewsletterLLMClient()
