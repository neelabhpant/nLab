"""Price Forecast — multi-signal forecast with LLM synthesis and explainability."""

import asyncio
import json
import logging
import math
import time
from pathlib import Path

from cachetools import TTLCache
from litellm import completion as litellm_completion

from app.services.coingecko import get_current_prices, get_historical
from app.services.news import get_news
from app.services.sentiment import compute_sentiment_summary
from app.services.llm import get_user_settings

logger = logging.getLogger(__name__)

_forecast_cache: TTLCache[str, dict] = TTLCache(maxsize=32, ttl=1800)

COIN_SYMBOLS = {
    "bitcoin": "BTC",
    "ripple": "XRP",
    "ethereum": "ETH",
    "solana": "SOL",
    "dogecoin": "DOGE",
}

HISTORY_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "forecast_history"


def _compute_technical_signals(prices: list[dict]) -> dict:
    """Compute technical indicators from historical price data."""
    if len(prices) < 20:
        return {"direction": "neutral", "confidence": 30, "summary": "Insufficient data for technical analysis"}

    closes = [p["price"] for p in prices]
    latest = closes[-1]

    sma_20 = sum(closes[-20:]) / 20
    sma_50 = sum(closes[-50:]) / 50 if len(closes) >= 50 else None

    deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    gains = [d for d in deltas[-14:] if d > 0]
    losses = [-d for d in deltas[-14:] if d < 0]
    avg_gain = sum(gains) / 14 if gains else 0
    avg_loss = sum(losses) / 14 if losses else 0.001
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))

    ema_12 = _ema(closes, 12)
    ema_26 = _ema(closes, 26)
    macd_line = ema_12 - ema_26 if ema_12 and ema_26 else 0

    bb_middle = sma_20
    bb_std = (sum((c - sma_20) ** 2 for c in closes[-20:]) / 20) ** 0.5
    bb_upper = bb_middle + 2 * bb_std
    bb_lower = bb_middle - 2 * bb_std

    week_change = ((latest - closes[-7]) / closes[-7] * 100) if len(closes) >= 7 else 0
    month_change = ((latest - closes[-30]) / closes[-30] * 100) if len(closes) >= 30 else 0

    signals = []
    if latest > sma_20:
        signals.append("above SMA-20")
    else:
        signals.append("below SMA-20")
    if sma_50 and latest > sma_50:
        signals.append("above SMA-50")
    elif sma_50:
        signals.append("below SMA-50")
    if rsi > 70:
        signals.append(f"RSI overbought ({rsi:.0f})")
    elif rsi < 30:
        signals.append(f"RSI oversold ({rsi:.0f})")
    else:
        signals.append(f"RSI neutral ({rsi:.0f})")
    if macd_line > 0:
        signals.append("MACD bullish")
    else:
        signals.append("MACD bearish")

    bullish_count = sum(1 for s in signals if any(w in s for w in ["above", "bullish", "oversold"]))
    bearish_count = sum(1 for s in signals if any(w in s for w in ["below", "bearish", "overbought"]))

    if bullish_count > bearish_count:
        direction = "bullish"
        confidence = min(90, 50 + bullish_count * 12)
    elif bearish_count > bullish_count:
        direction = "bearish"
        confidence = min(90, 50 + bearish_count * 12)
    else:
        direction = "neutral"
        confidence = 45

    return {
        "direction": direction,
        "confidence": confidence,
        "current_price": round(latest, 2),
        "sma_20": round(sma_20, 2),
        "sma_50": round(sma_50, 2) if sma_50 else None,
        "rsi": round(rsi, 1),
        "macd_line": round(macd_line, 4),
        "bb_upper": round(bb_upper, 2),
        "bb_lower": round(bb_lower, 2),
        "week_change_pct": round(week_change, 2),
        "month_change_pct": round(month_change, 2),
        "signals": signals,
        "summary": f"Price {'above' if latest > sma_20 else 'below'} SMA-20, RSI {rsi:.0f}, MACD {'bullish' if macd_line > 0 else 'bearish'}, {week_change:+.1f}% 7d",
    }


def _ema(values: list[float], period: int) -> float | None:
    """Compute exponential moving average."""
    if len(values) < period:
        return None
    multiplier = 2 / (period + 1)
    ema = sum(values[:period]) / period
    for v in values[period:]:
        ema = (v - ema) * multiplier + ema
    return ema


def _compute_fundamentals_signals(
    prices: list[dict],
    current_data: dict,
) -> dict:
    """Compute fundamental/volume signals from price and market data."""
    if len(prices) < 14:
        return {"direction": "neutral", "confidence": 30, "summary": "Insufficient data"}

    closes = [p["price"] for p in prices]
    latest = closes[-1]

    returns = [(closes[i] - closes[i - 1]) / closes[i - 1] for i in range(1, len(closes))]
    volatility_30d = (sum(r ** 2 for r in returns[-30:]) / min(30, len(returns[-30:]))) ** 0.5 * 100 if len(returns) >= 7 else 0

    high_90d = max(closes[-90:]) if len(closes) >= 90 else max(closes)
    low_90d = min(closes[-90:]) if len(closes) >= 90 else min(closes)
    range_position = (latest - low_90d) / (high_90d - low_90d) if high_90d != low_90d else 0.5

    mcap = current_data.get("usd_market_cap", 0)
    change_24h = current_data.get("usd_24h_change", 0) or 0

    momentum_7d = ((latest - closes[-7]) / closes[-7]) if len(closes) >= 7 else 0
    momentum_30d = ((latest - closes[-30]) / closes[-30]) if len(closes) >= 30 else 0

    signals = []
    if range_position > 0.7:
        signals.append("near 90-day high")
    elif range_position < 0.3:
        signals.append("near 90-day low (potential value)")
    if volatility_30d > 5:
        signals.append("high volatility")
    elif volatility_30d < 2:
        signals.append("low volatility")
    if momentum_7d > 0 and momentum_30d > 0:
        signals.append("positive momentum")
    elif momentum_7d < 0 and momentum_30d < 0:
        signals.append("negative momentum")

    bullish = sum(1 for s in signals if any(w in s for w in ["positive", "value", "low vol"]))
    bearish = sum(1 for s in signals if any(w in s for w in ["negative", "high vol", "near 90-day high"]))

    if bullish > bearish:
        direction = "bullish"
        confidence = min(85, 45 + bullish * 15)
    elif bearish > bullish:
        direction = "bearish"
        confidence = min(85, 45 + bearish * 15)
    else:
        direction = "neutral"
        confidence = 40

    return {
        "direction": direction,
        "confidence": confidence,
        "volatility_30d": round(volatility_30d, 2),
        "range_position": round(range_position, 2),
        "market_cap_b": round(mcap / 1e9, 1) if mcap else None,
        "change_24h": round(change_24h, 2),
        "momentum_7d": round(momentum_7d * 100, 2),
        "momentum_30d": round(momentum_30d * 100, 2),
        "signals": signals,
        "summary": f"Vol {volatility_30d:.1f}%, range pos {range_position:.0%}, 7d mom {momentum_7d * 100:+.1f}%",
    }


def _build_forecast_prompt(
    coin_id: str,
    symbol: str,
    horizon_days: int,
    current_price: float,
    technical: dict,
    sentiment: dict,
    fundamentals: dict,
    articles: list[dict],
) -> str:
    """Build the LLM prompt for forecast synthesis."""
    news_lines = []
    for i, a in enumerate(articles[:5], 1):
        title = a.get("title", "")
        source = a.get("source", "")
        news_lines.append(f"  {i}. {title} ({source})")

    return (
        f"You are a quantitative crypto analyst. Synthesize the following signals into a "
        f"{horizon_days}-day price forecast for {symbol} ({coin_id}).\n\n"
        f"CURRENT PRICE: ${current_price:,.2f}\n\n"
        f"TECHNICAL SIGNALS:\n"
        f"  Direction: {technical['direction']} (confidence {technical['confidence']}%)\n"
        f"  SMA-20: ${technical.get('sma_20', 'N/A')}, RSI: {technical.get('rsi', 'N/A')}\n"
        f"  MACD: {'bullish' if (technical.get('macd_line', 0) or 0) > 0 else 'bearish'}\n"
        f"  Bollinger: ${technical.get('bb_lower', 'N/A')} — ${technical.get('bb_upper', 'N/A')}\n"
        f"  7d change: {technical.get('week_change_pct', 0):+.1f}%, 30d: {technical.get('month_change_pct', 0):+.1f}%\n"
        f"  Signals: {', '.join(technical.get('signals', []))}\n\n"
        f"SENTIMENT SIGNALS:\n"
        f"  Score: {sentiment.get('score', 0):+.3f} (range -1 to +1)\n"
        f"  Trend: {sentiment.get('trend', 'stable')}\n"
        f"  Articles analyzed: {sentiment.get('article_count', 0)}\n"
        f"  Top bullish: {sentiment.get('top_bullish', 'N/A')}\n"
        f"  Top bearish: {sentiment.get('top_bearish', 'N/A')}\n\n"
        f"FUNDAMENTAL SIGNALS:\n"
        f"  Direction: {fundamentals['direction']} (confidence {fundamentals['confidence']}%)\n"
        f"  30d volatility: {fundamentals.get('volatility_30d', 'N/A')}%\n"
        f"  90d range position: {fundamentals.get('range_position', 'N/A')} (0=low, 1=high)\n"
        f"  Market cap: ${fundamentals.get('market_cap_b', 'N/A')}B\n"
        f"  7d momentum: {fundamentals.get('momentum_7d', 0):+.1f}%\n"
        f"  30d momentum: {fundamentals.get('momentum_30d', 0):+.1f}%\n\n"
        f"RECENT NEWS:\n" + ("\n".join(news_lines) if news_lines else "  No recent news") + "\n\n"
        f"Return ONLY valid JSON with this exact structure (no markdown, no code fences):\n"
        "{\n"
        f'  "coin": "{symbol}",\n'
        f'  "current_price": {current_price},\n'
        f'  "horizon_days": {horizon_days},\n'
        '  "bull_case": {"price": <number>, "probability": <0-100>},\n'
        '  "base_case": {"price": <number>, "probability": <0-100>},\n'
        '  "bear_case": {"price": <number>, "probability": <0-100>},\n'
        '  "confidence": <0-100 overall confidence>,\n'
        '  "direction": "bullish" or "bearish" or "neutral",\n'
        '  "signals": {\n'
        '    "technical": {"direction": "...", "confidence": <n>, "summary": "1 sentence"},\n'
        '    "sentiment": {"direction": "...", "confidence": <n>, "summary": "1 sentence"},\n'
        '    "fundamentals": {"direction": "...", "confidence": <n>, "summary": "1 sentence"}\n'
        "  },\n"
        '  "explanation": "3-4 sentence synthesis explaining the forecast, highlighting which signals agree/disagree and key risks"\n'
        "}\n\n"
        "Rules:\n"
        "- bull/base/bear probabilities MUST sum to 100\n"
        "- Price targets should be realistic based on the data (not more than ±30% for 7d, ±50% for 30d)\n"
        "- base_case should be the most probable outcome\n"
        "- confidence reflects how much the signals agree (high agreement = high confidence)\n"
        "- explanation should reference specific data points from the signals above\n"
        "- Be precise with numbers, not vague"
    )


def _generate_forecast(
    coin_id: str,
    symbol: str,
    horizon_days: int,
    current_price: float,
    technical: dict,
    sentiment: dict,
    fundamentals: dict,
    articles: list[dict],
) -> dict:
    """Generate forecast via single LLM call."""
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

    prompt = _build_forecast_prompt(
        coin_id, symbol, horizon_days, current_price, technical, sentiment, fundamentals, articles
    )

    response = litellm_completion(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        api_key=api_key,
        max_completion_tokens=600,
    )

    raw = response.choices[0].message.content.strip()
    start = raw.find("{")
    end = raw.rfind("}") + 1
    if start < 0 or end <= start:
        return _fallback_forecast(symbol, current_price, horizon_days, technical, sentiment, fundamentals)

    try:
        return json.loads(raw[start:end])
    except json.JSONDecodeError:
        return _fallback_forecast(symbol, current_price, horizon_days, technical, sentiment, fundamentals)


def _fallback_forecast(
    symbol: str,
    current_price: float,
    horizon_days: int,
    technical: dict,
    sentiment: dict,
    fundamentals: dict,
) -> dict:
    """Generate a basic forecast without LLM if it fails."""
    direction = technical.get("direction", "neutral")
    pct = 0.05 if horizon_days <= 7 else 0.10 if horizon_days <= 14 else 0.15
    if direction == "bullish":
        bull = current_price * (1 + pct * 1.5)
        base = current_price * (1 + pct * 0.5)
        bear = current_price * (1 - pct * 0.5)
    elif direction == "bearish":
        bull = current_price * (1 + pct * 0.5)
        base = current_price * (1 - pct * 0.5)
        bear = current_price * (1 - pct * 1.5)
    else:
        bull = current_price * (1 + pct)
        base = current_price
        bear = current_price * (1 - pct)

    return {
        "coin": symbol,
        "current_price": current_price,
        "horizon_days": horizon_days,
        "bull_case": {"price": round(bull, 2), "probability": 25},
        "base_case": {"price": round(base, 2), "probability": 50},
        "bear_case": {"price": round(bear, 2), "probability": 25},
        "confidence": 40,
        "direction": direction,
        "signals": {
            "technical": {"direction": technical.get("direction", "neutral"), "confidence": technical.get("confidence", 40), "summary": technical.get("summary", "")},
            "sentiment": {"direction": "bullish" if sentiment.get("score", 0) > 0.1 else "bearish" if sentiment.get("score", 0) < -0.1 else "neutral", "confidence": 40, "summary": f"Sentiment score {sentiment.get('score', 0):+.2f}"},
            "fundamentals": {"direction": fundamentals.get("direction", "neutral"), "confidence": fundamentals.get("confidence", 40), "summary": fundamentals.get("summary", "")},
        },
        "explanation": "Forecast generated from quantitative signals only (LLM synthesis unavailable).",
    }


async def get_price_forecast(coin_id: str, horizon_days: int = 7) -> dict:
    """Generate or return cached price forecast."""
    cache_key = f"{coin_id}:{horizon_days}"
    if cache_key in _forecast_cache:
        return _forecast_cache[cache_key]

    symbol = COIN_SYMBOLS.get(coin_id, coin_id.upper())

    history_days = max(90, horizon_days * 3)
    prices_task = get_current_prices([coin_id])
    history_task = get_historical(coin_id, history_days)
    sentiment_task = compute_sentiment_summary(coin_id)
    news_task = get_news([symbol], limit=5)

    current_prices, history, sentiment, articles = await asyncio.gather(
        prices_task, history_task, sentiment_task, news_task
    )

    current_data = current_prices[0] if current_prices else {}
    current_price = current_data.get("usd", 0)
    price_points = history.get("prices", [])

    technical = _compute_technical_signals(price_points)
    fundamentals = _compute_fundamentals_signals(price_points, current_data)

    max_retries = 2
    last_error: Exception | None = None
    for attempt in range(max_retries):
        try:
            forecast = await asyncio.to_thread(
                _generate_forecast,
                coin_id, symbol, horizon_days, current_price,
                technical, sentiment, fundamentals, articles,
            )
            break
        except Exception as e:
            last_error = e
            logger.warning("Forecast attempt %d/%d failed: %s", attempt + 1, max_retries, e)
            if attempt < max_retries - 1:
                await asyncio.sleep(1)
    else:
        forecast = _fallback_forecast(symbol, current_price, horizon_days, technical, sentiment, fundamentals)

    result = {
        "coin_id": coin_id,
        "coin": symbol,
        "current_price": current_price,
        "horizon_days": horizon_days,
        "bull_case": forecast.get("bull_case", {}),
        "base_case": forecast.get("base_case", {}),
        "bear_case": forecast.get("bear_case", {}),
        "confidence": forecast.get("confidence", 50),
        "direction": forecast.get("direction", "neutral"),
        "signals": forecast.get("signals", {}),
        "explanation": forecast.get("explanation", ""),
        "generated_at": int(time.time()),
    }

    _forecast_cache[cache_key] = result
    _save_forecast_history(result)
    return result


def invalidate_forecast_cache(coin_id: str, horizon_days: int) -> None:
    """Clear forecast cache for a specific coin+horizon."""
    cache_key = f"{coin_id}:{horizon_days}"
    _forecast_cache.pop(cache_key, None)


def _save_forecast_history(forecast: dict) -> None:
    """Persist forecast to history for accuracy tracking."""
    HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    coin_id = forecast.get("coin_id", "unknown")
    path = HISTORY_DIR / f"{coin_id}.json"

    history: list[dict] = []
    if path.exists():
        try:
            history = json.loads(path.read_text())
        except (json.JSONDecodeError, OSError):
            history = []

    history.append(forecast)
    history = history[-50:]

    path.write_text(json.dumps(history, indent=2))


def get_forecast_history(coin_id: str) -> list[dict]:
    """Load past forecasts for a coin."""
    path = HISTORY_DIR / f"{coin_id}.json"
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text())
    except (json.JSONDecodeError, OSError):
        return []
