import asyncio
import logging
import time

from cachetools import TTLCache

from app.services.crew import build_market_brief_crew

logger = logging.getLogger(__name__)

_brief_cache: TTLCache[str, dict] = TTLCache(maxsize=1, ttl=3600)


async def get_market_brief() -> dict:
    """Generate or return cached AI market brief.

    Kicks off a CrewAI crew to produce a concise market summary.
    Caches the result for 1 hour.
    """
    cache_key = "market_brief"
    if cache_key in _brief_cache:
        return _brief_cache[cache_key]

    max_retries = 3
    last_error: Exception | None = None
    for attempt in range(max_retries):
        try:
            crew = build_market_brief_crew()
            result = await asyncio.to_thread(crew.kickoff)
            break
        except Exception as e:
            last_error = e
            logger.warning("Market brief attempt %d/%d failed: %s", attempt + 1, max_retries, e)
            if attempt < max_retries - 1:
                await asyncio.sleep(2 ** attempt)
    else:
        raise last_error  # type: ignore[misc]

    brief = {
        "content": str(result),
        "generated_at": int(time.time()),
    }

    _brief_cache[cache_key] = brief
    return brief


def invalidate_brief_cache() -> None:
    """Clear the market brief cache to force regeneration."""
    _brief_cache.clear()
