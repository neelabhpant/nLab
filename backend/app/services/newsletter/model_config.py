"""Model selection for Newsletter Composer generation.

Spec §2.2 — generation enforces Claude Opus 4.7. Voice verification uses
Haiku (cheap and deterministic). If Opus 4.7 is unavailable at request
time, the LLM client falls back to the user's configured Anthropic model
and logs the fallback.
"""

# Default generation model. The actual model is resolved per request from user
# settings (newsletter_generation_model); this is the fallback default.
GENERATION_MODEL = "claude-sonnet-4-6"
GENERATION_PROVIDER = "anthropic"

VOICE_CHECK_MODEL = "claude-haiku-4-5"
VOICE_CHECK_PROVIDER = "anthropic"

# Models offered for the newsletter generation toggle (Settings).
GENERATION_MODEL_CHOICES = ["claude-sonnet-4-6", "claude-opus-4-7"]

MAX_TOKENS_GENERATION = 1024
MAX_TOKENS_VOICE_CHECK = 1024

TEMPERATURE_GENERATION = 0.7
TEMPERATURE_VOICE_CHECK = 0.0

# Per-call timeout in seconds. Used by the router to translate slow responses
# into 504s with a clear error.
LLM_TIMEOUT_SECONDS = 30

# USD per 1M tokens (input, output), by model. Used to estimate session cost
# for the composer header. Update if Anthropic pricing changes.
MODEL_PRICING: dict[str, tuple[float, float]] = {
    "claude-opus-4-7": (15.0, 75.0),
    "claude-opus-4-6": (15.0, 75.0),
    "claude-sonnet-4-6": (3.0, 15.0),
    "claude-haiku-4-5": (1.0, 5.0),
}

# Human-friendly model labels for the UI.
MODEL_LABELS: dict[str, str] = {
    "claude-opus-4-7": "Opus 4.7",
    "claude-opus-4-6": "Opus 4.6",
    "claude-sonnet-4-6": "Sonnet 4.6",
    "claude-haiku-4-5": "Haiku 4.5",
}


def cost_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    """Estimated USD cost for a single call. Unknown models price at 0."""
    in_rate, out_rate = MODEL_PRICING.get(model, (0.0, 0.0))
    return (input_tokens * in_rate + output_tokens * out_rate) / 1_000_000
