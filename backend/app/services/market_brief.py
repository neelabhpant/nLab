"""AI Market Brief — direct LLM call with pre-fetched context."""

import asyncio
import json
import logging
import time

from cachetools import TTLCache
from litellm import completion as litellm_completion

from app.services.coingecko import get_current_prices
from app.services.news import get_news
from app.services.llm import get_user_settings

logger = logging.getLogger(__name__)

_brief_cache: TTLCache[str, dict] = TTLCache(maxsize=1, ttl=3600)

ALL_COINS = ["bitcoin", "ripple", "ethereum", "solana", "dogecoin"]
COIN_SYMBOLS = {
    "bitcoin": "BTC",
    "ripple": "XRP",
    "ethereum": "ETH",
    "solana": "SOL",
    "dogecoin": "DOGE",
}


def _build_prompt(prices: list[dict], articles: list[dict]) -> str:
    """Build the LLM prompt with pre-fetched price and news context."""
    price_lines = []
    for p in prices:
        sym = COIN_SYMBOLS.get(p["coin_id"], p["coin_id"].upper())
        usd = p.get("usd") or 0
        change = p.get("usd_24h_change") or 0
        mcap = p.get("usd_market_cap") or 0
        price_lines.append(
            f"  {sym}: ${usd:,.2f} ({change:+.2f}% 24h) — MCap ${mcap/1e9:.1f}B"
        )

    news_lines = []
    for i, a in enumerate(articles[:5], 1):
        title = a.get("title", "")
        source = a.get("source", "")
        related = ", ".join(a.get("related_coins", [])[:3])
        news_lines.append(f"  {i}. {title} ({source}) [{related}]")

    return (
        "You are a financial market analyst. Given the live crypto prices and recent news below, "
        "produce a market brief.\n\n"
        f"LIVE PRICES:\n" + "\n".join(price_lines) + "\n\n"
        f"RECENT NEWS:\n" + "\n".join(news_lines) + "\n\n"
        "Return ONLY valid JSON with this exact structure (no markdown, no code fences):\n"
        "{\n"
        '  "headline": "One punchy sentence summarizing the market right now",\n'
        '  "summary": "2-3 sentence analysis covering key movements and what is driving them",\n'
        '  "sentiment": "bullish" or "bearish" or "neutral",\n'
        '  "top_mover": {\n'
        '    "coin": "SYMBOL",\n'
        '    "change": "+X.XX%",\n'
        '    "reason": "One sentence why this coin moved the most"\n'
        "  }\n"
        "}\n\n"
        "Rules:\n"
        "- Use the ACTUAL prices and percentages from the data above\n"
        "- top_mover should be the coin with the largest absolute 24h change\n"
        "- headline should reference the overall market direction\n"
        "- summary should mention specific prices and reference relevant news if applicable\n"
        "- Keep it concise and professional"
    )


def _generate_brief(prices: list[dict], articles: list[dict]) -> dict:
    """Generate a structured market brief via a single LLM call."""
    settings = get_user_settings()
    provider = settings["provider"]
    if provider == "anthropic":
        model = f"anthropic/{settings['anthropic_model']}"
        api_key = settings["anthropic_api_key"]
    elif provider == "groq":
        model_name = settings["groq_model"]
        if not model_name.startswith("groq/"):
            model_name = f"groq/{model_name}"
        model = model_name
        api_key = settings["groq_api_key"]
    else:
        model = f"openai/{settings['openai_model']}"
        api_key = settings["openai_api_key"]

    prompt = _build_prompt(prices, articles)

    response = litellm_completion(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        api_key=api_key,
        max_completion_tokens=400,
    )

    raw = response.choices[0].message.content.strip()
    start = raw.find("{")
    end = raw.rfind("}") + 1
    if start < 0 or end <= start:
        return {
            "headline": "Market data available",
            "summary": raw[:300],
            "sentiment": "neutral",
            "top_mover": None,
        }

    return json.loads(raw[start:end])


async def get_market_brief() -> dict:
    """Generate or return cached structured AI market brief."""
    cache_key = "market_brief"
    if cache_key in _brief_cache:
        return _brief_cache[cache_key]

    prices, articles = await asyncio.gather(
        get_current_prices(ALL_COINS),
        get_news(limit=5),
    )

    max_retries = 2
    last_error: Exception | None = None
    for attempt in range(max_retries):
        try:
            structured = await asyncio.to_thread(_generate_brief, prices, articles)
            break
        except Exception as e:
            last_error = e
            logger.warning("Market brief attempt %d/%d failed: %s", attempt + 1, max_retries, e)
            if attempt < max_retries - 1:
                await asyncio.sleep(1)
    else:
        raise last_error  # type: ignore[misc]

    brief = {
        "headline": structured.get("headline", ""),
        "summary": structured.get("summary", ""),
        "sentiment": structured.get("sentiment", "neutral"),
        "top_mover": structured.get("top_mover"),
        "generated_at": int(time.time()),
    }

    _brief_cache[cache_key] = brief
    return brief


def invalidate_brief_cache() -> None:
    """Clear the market brief cache to force regeneration."""
    _brief_cache.clear()
