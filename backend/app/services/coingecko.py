import asyncio
import logging

import httpx
from cachetools import TTLCache

from app.config import get_settings

logger = logging.getLogger(__name__)

_price_cache: TTLCache[str, list[dict]] = TTLCache(maxsize=128, ttl=60)
_history_cache: TTLCache[str, dict] = TTLCache(maxsize=128, ttl=300)

MAX_RETRIES = 3
BACKOFF_BASE = 2.0


async def _request_with_retry(
    client: httpx.AsyncClient,
    url: str,
    params: dict,
) -> dict:
    """Make a GET request with exponential backoff on 429 rate limits."""
    for attempt in range(MAX_RETRIES):
        resp = await client.get(url, params=params, timeout=10.0)
        if resp.status_code == 429:
            wait = BACKOFF_BASE * (2 ** attempt)
            logger.warning("CoinGecko 429 rate limit, retrying in %.1fs (attempt %d/%d)", wait, attempt + 1, MAX_RETRIES)
            await asyncio.sleep(wait)
            continue
        resp.raise_for_status()
        return resp.json()
    raise httpx.HTTPStatusError(
        "Rate limited after max retries",
        request=httpx.Request("GET", url),
        response=resp,
    )


async def get_current_prices(coin_ids: list[str]) -> list[dict]:
    """Fetch current USD price, 24h change, and market cap for multiple coins."""
    cache_key = ",".join(sorted(coin_ids))
    if cache_key in _price_cache:
        return _price_cache[cache_key]

    settings = get_settings()
    async with httpx.AsyncClient() as client:
        data = await _request_with_retry(
            client,
            f"{settings.coingecko_api_url}/simple/price",
            params={
                "ids": ",".join(coin_ids),
                "vs_currencies": "usd",
                "include_24hr_change": "true",
                "include_market_cap": "true",
            },
        )

    results = []
    for coin_id in coin_ids:
        coin_data = data.get(coin_id, {})
        results.append({
            "coin_id": coin_id,
            "usd": coin_data.get("usd"),
            "usd_24h_change": coin_data.get("usd_24h_change"),
            "usd_market_cap": coin_data.get("usd_market_cap"),
        })

    _price_cache[cache_key] = results
    return results


async def get_historical(coin_id: str, days: int = 30) -> dict:
    """Fetch historical market chart data from CoinGecko."""
    cache_key = f"{coin_id}:{days}"
    if cache_key in _history_cache:
        return _history_cache[cache_key]

    settings = get_settings()
    async with httpx.AsyncClient() as client:
        data = await _request_with_retry(
            client,
            f"{settings.coingecko_api_url}/coins/{coin_id}/market_chart",
            params={"vs_currency": "usd", "days": days},
        )

    prices = [
        {"timestamp": int(ts), "price": price}
        for ts, price in data.get("prices", [])
    ]

    result = {"coin_id": coin_id, "days": days, "prices": prices}
    _history_cache[cache_key] = result
    return result
