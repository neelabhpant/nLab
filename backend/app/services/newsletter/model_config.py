"""Model selection for Newsletter Composer generation.

Spec §2.2 — generation enforces Claude Opus 4.7. Voice verification uses
Haiku (cheap and deterministic). If Opus 4.7 is unavailable at request
time, the LLM client falls back to the user's configured Anthropic model
and logs the fallback.
"""

GENERATION_MODEL = "claude-opus-4-7"
GENERATION_PROVIDER = "anthropic"

VOICE_CHECK_MODEL = "claude-haiku-4-5"
VOICE_CHECK_PROVIDER = "anthropic"

MAX_TOKENS_GENERATION = 1024
MAX_TOKENS_VOICE_CHECK = 1024

TEMPERATURE_GENERATION = 0.7
TEMPERATURE_VOICE_CHECK = 0.0

# Per-call timeout in seconds. Used by the router to translate slow responses
# into 504s with a clear error.
LLM_TIMEOUT_SECONDS = 30
