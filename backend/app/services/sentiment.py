"""Sentiment analysis service using keyword-based scoring on crypto news."""

import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from cachetools import TTLCache

from app.services.news import get_news

logger = logging.getLogger(__name__)

BULLISH_KEYWORDS: list[str] = [
    "surge", "rally", "breakthrough", "adoption", "approval", "partnership",
    "bullish", "gains", "soars", "record", "all-time high", "ath", "upgrade",
    "accumulate", "institutional", "etf approved", "mainstream", "milestone",
    "breakout", "recovery", "optimistic", "growth", "profit", "moon",
]

BEARISH_KEYWORDS: list[str] = [
    "crash", "plunge", "ban", "hack", "lawsuit", "bearish", "losses", "fraud",
    "dump", "collapse", "scam", "investigation", "fine", "penalty", "sell-off",
    "selloff", "decline", "warning", "risk", "concern", "fear", "bubble",
    "liquidation", "exploit", "vulnerability", "sec charges",
]

COIN_SYMBOL_MAP: dict[str, str] = {
    "bitcoin": "BTC",
    "ripple": "XRP",
    "ethereum": "ETH",
    "solana": "SOL",
    "dogecoin": "DOGE",
}

_heatmap_cache: TTLCache[str, list[dict]] = TTLCache(maxsize=64, ttl=1800)
_summary_cache: TTLCache[str, dict] = TTLCache(maxsize=16, ttl=1800)


def score_article(title: str, body: str) -> float:
    """Score an article's sentiment from -1 (bearish) to +1 (bullish)."""
    text = f"{title} {body}".lower()
    bull_count = sum(1 for kw in BULLISH_KEYWORDS if kw in text)
    bear_count = sum(1 for kw in BEARISH_KEYWORDS if kw in text)
    total = bull_count + bear_count
    if total == 0:
        return 0.0
    raw = (bull_count - bear_count) / total
    return max(-1.0, min(1.0, raw))


async def compute_daily_sentiment(coin: str, days: int = 30) -> list[dict]:
    """Compute daily sentiment scores for a coin.

    Args:
        coin: CoinGecko coin ID (e.g. 'bitcoin').
        days: Number of days to look back.

    Returns:
        List of {date: str, score: float, article_count: int} sorted by date.
    """
    cache_key = f"{coin}:{days}"
    if cache_key in _heatmap_cache:
        return _heatmap_cache[cache_key]

    symbol = COIN_SYMBOL_MAP.get(coin, coin.upper())
    articles = await get_news([symbol], limit=50)

    daily: dict[str, list[float]] = defaultdict(list)
    now = datetime.now(timezone.utc)

    for article in articles:
        ts = article.get("published_at", 0)
        if ts == 0:
            continue
        pub_date = datetime.fromtimestamp(ts, tz=timezone.utc)
        age_days = (now - pub_date).days
        if age_days > days:
            continue
        date_str = pub_date.strftime("%Y-%m-%d")
        score = score_article(article.get("title", ""), article.get("body", ""))
        daily[date_str].append(score)

    today = now.date()
    result = []
    for i in range(days):
        d = today - timedelta(days=days - 1 - i)
        date_str = d.strftime("%Y-%m-%d")
        scores = daily.get(date_str, [])
        avg = sum(scores) / len(scores) if scores else 0.0
        result.append({
            "date": date_str,
            "score": round(avg, 3),
            "article_count": len(scores),
        })

    _heatmap_cache[cache_key] = result
    return result


async def compute_sentiment_summary(coin: str) -> dict:
    """Compute current sentiment summary for a coin.

    Args:
        coin: CoinGecko coin ID.

    Returns:
        Dict with score, trend, article_count, top_bullish, top_bearish.
    """
    cache_key = f"summary:{coin}"
    if cache_key in _summary_cache:
        return _summary_cache[cache_key]

    symbol = COIN_SYMBOL_MAP.get(coin, coin.upper())
    articles = await get_news([symbol], limit=30)

    if not articles:
        return {
            "coin": coin,
            "score": 0.0,
            "trend": "stable",
            "article_count": 0,
            "top_bullish": None,
            "top_bearish": None,
        }

    scored = []
    for i, article in enumerate(articles):
        s = score_article(article.get("title", ""), article.get("body", ""))
        weight = 1.0 / (1 + i * 0.15)
        scored.append((s, weight, article))

    total_weight = sum(w for _, w, _ in scored)
    weighted_score = sum(s * w for s, w, _ in scored) / total_weight if total_weight else 0.0

    recent_half = scored[:len(scored) // 2] if len(scored) >= 4 else scored
    older_half = scored[len(scored) // 2:] if len(scored) >= 4 else []

    if older_half:
        recent_avg = sum(s for s, _, _ in recent_half) / len(recent_half)
        older_avg = sum(s for s, _, _ in older_half) / len(older_half)
        diff = recent_avg - older_avg
        if diff > 0.1:
            trend = "improving"
        elif diff < -0.1:
            trend = "declining"
        else:
            trend = "stable"
    else:
        trend = "stable"

    bullish = [(s, a) for s, _, a in scored if s > 0]
    bearish = [(s, a) for s, _, a in scored if s < 0]
    bullish.sort(key=lambda x: x[0], reverse=True)
    bearish.sort(key=lambda x: x[0])

    result = {
        "coin": coin,
        "score": round(max(-1.0, min(1.0, weighted_score)), 3),
        "trend": trend,
        "article_count": len(scored),
        "top_bullish": bullish[0][1].get("title") if bullish else None,
        "top_bearish": bearish[0][1].get("title") if bearish else None,
    }

    _summary_cache[cache_key] = result
    return result
