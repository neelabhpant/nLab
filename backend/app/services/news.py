import logging

import httpx
from cachetools import TTLCache

logger = logging.getLogger(__name__)

_news_cache: TTLCache[str, list[dict]] = TTLCache(maxsize=32, ttl=300)

CRYPTOCOMPARE_NEWS_URL = "https://min-api.cryptocompare.com/data/v2/news/"

SYMBOL_TO_CATEGORIES: dict[str, str] = {
    "BTC": "BTC",
    "XRP": "XRP",
    "ETH": "ETH",
    "SOL": "SOL",
    "DOGE": "DOGE",
}


async def get_news(coins: list[str] | None = None, limit: int = 20) -> list[dict]:
    """Fetch latest crypto news from CryptoCompare.

    Args:
        coins: Optional list of coin symbols (e.g. ['BTC', 'XRP']) to filter by.
        limit: Maximum number of articles to return.

    Returns:
        List of news article dicts.
    """
    categories = None
    if coins:
        cats = [SYMBOL_TO_CATEGORIES.get(c.upper(), c.upper()) for c in coins]
        categories = ",".join(cats)

    cache_key = f"{categories or 'all'}:{limit}"
    if cache_key in _news_cache:
        return _news_cache[cache_key]

    params: dict[str, str | int] = {"lang": "EN"}
    if categories:
        params["categories"] = categories

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            CRYPTOCOMPARE_NEWS_URL,
            params=params,
            timeout=10.0,
        )
        resp.raise_for_status()
        data = resp.json()

    raw_articles = data.get("Data", [])[:limit]

    articles = []
    for article in raw_articles:
        cats_str = article.get("categories", "")
        related = [c.strip() for c in cats_str.split("|") if c.strip()] if cats_str else []

        articles.append({
            "title": article.get("title", ""),
            "source": article.get("source_info", {}).get("name", article.get("source", "")),
            "url": article.get("url", ""),
            "published_at": article.get("published_on", 0),
            "image_url": article.get("imageurl", ""),
            "related_coins": related,
            "body": article.get("body", ""),
        })

    _news_cache[cache_key] = articles
    return articles
