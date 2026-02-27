import asyncio
import json
from typing import Any, Coroutine, Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field, field_validator

from app.services.coingecko import get_current_prices, get_historical
from app.services.news import get_news
from app.services.normalize import min_max_normalize, z_score_normalize
from app.services.sentiment import compute_sentiment_summary


def _run_async(coro: Coroutine[Any, Any, Any]) -> Any:
    """Run an async coroutine from sync context, handling existing event loops."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None
    if loop and loop.is_running():
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            return pool.submit(asyncio.run, coro).result()
    return asyncio.run(coro)


class GetCurrentPriceInput(BaseModel):
    coin_ids: str = Field(
        ...,
        description="Comma-separated CoinGecko coin IDs, e.g. 'bitcoin,ripple,ethereum'",
    )


class GetCurrentPriceTool(BaseTool):
    name: str = "get_current_price"
    description: str = (
        "Get the current USD price, 24h percentage change, and market cap "
        "for one or more cryptocurrencies. Pass comma-separated CoinGecko "
        "coin IDs like 'bitcoin', 'ripple', 'ethereum', 'solana', 'dogecoin'."
    )
    args_schema: Type[BaseModel] = GetCurrentPriceInput

    def _run(self, coin_ids: str) -> str:
        """Fetch current prices synchronously by running the async function."""
        ids = [c.strip() for c in coin_ids.split(",") if c.strip()]
        data = _run_async(get_current_prices(ids))
        return json.dumps(data, indent=2)


class GetHistoricalDataInput(BaseModel):
    coin_id: str = Field(
        ...,
        description="CoinGecko coin ID, e.g. 'bitcoin' or 'ripple'",
    )
    days: int = Field(
        30,
        description="Number of days of history (1-365). Default 30.",
    )

    @field_validator("days", mode="before")
    @classmethod
    def coerce_days(cls, v: object) -> int:
        try:
            return int(v)
        except (TypeError, ValueError):
            return 30


class GetHistoricalDataTool(BaseTool):
    name: str = "get_historical_data"
    description: str = (
        "Get historical price data for a cryptocurrency over a specified "
        "number of days. Returns timestamped price points. Use this to "
        "analyze price trends, calculate returns, or identify patterns."
    )
    args_schema: Type[BaseModel] = GetHistoricalDataInput

    def _run(self, coin_id: str, days: int = 30) -> str:
        """Fetch historical data synchronously."""
        data = _run_async(get_historical(coin_id, days))
        prices = data["prices"]
        if len(prices) > 60:
            step = len(prices) // 60
            prices = prices[::step] + [prices[-1]]
        summary = {
            "coin_id": data["coin_id"],
            "days": data["days"],
            "total_points": len(data["prices"]),
            "first_price": data["prices"][0]["price"] if data["prices"] else None,
            "last_price": data["prices"][-1]["price"] if data["prices"] else None,
            "prices": prices,
        }
        return json.dumps(summary, indent=2)


class CompareAssetsInput(BaseModel):
    coin_ids: str = Field(
        ...,
        description="Comma-separated CoinGecko coin IDs to compare, e.g. 'bitcoin,ripple'",
    )
    days: int = Field(
        30,
        description="Number of days of history (1-365). Default 30.",
    )
    method: str = Field(
        "minmax",
        description="Normalization method: 'minmax' (0-1 scale) or 'zscore' (standard deviations). Default 'minmax'.",
    )

    @field_validator("days", mode="before")
    @classmethod
    def coerce_days(cls, v: object) -> int:
        try:
            return int(v)
        except (TypeError, ValueError):
            return 30


def _pearson(a: list[float], b: list[float]) -> float | None:
    """Compute Pearson correlation coefficient."""
    n = min(len(a), len(b))
    if n < 2:
        return None
    sum_a = sum(a[:n])
    sum_b = sum(b[:n])
    mean_a = sum_a / n
    mean_b = sum_b / n
    cov = sum((a[i] - mean_a) * (b[i] - mean_b) for i in range(n))
    var_a = sum((a[i] - mean_a) ** 2 for i in range(n))
    var_b = sum((b[i] - mean_b) ** 2 for i in range(n))
    denom = (var_a * var_b) ** 0.5
    if denom == 0:
        return None
    return cov / denom


class CompareAssetsTool(BaseTool):
    name: str = "compare_assets"
    description: str = (
        "Compare two or more crypto assets by normalizing their price history "
        "and computing correlation. Returns normalized series and Pearson "
        "correlation coefficients between all pairs. Use this for comparative "
        "analysis, identifying divergences, and correlation studies."
    )
    args_schema: Type[BaseModel] = CompareAssetsInput

    def _run(self, coin_ids: str, days: int = 30, method: str = "minmax") -> str:
        """Fetch, normalize, and compare assets synchronously."""
        ids = [c.strip() for c in coin_ids.split(",") if c.strip()]
        if len(ids) < 2:
            return json.dumps({"error": "At least 2 coin IDs required"})

        normalize = min_max_normalize if method == "minmax" else z_score_normalize

        async def _fetch_all() -> list[dict]:
            return await asyncio.gather(*[get_historical(cid, days) for cid in ids])
        results = _run_async(_fetch_all())

        series_data = []
        for hist in results:
            raw_prices = [p["price"] for p in hist["prices"]]
            normalized = normalize(raw_prices)
            series_data.append({
                "coin_id": hist["coin_id"],
                "first_price": raw_prices[0] if raw_prices else None,
                "last_price": raw_prices[-1] if raw_prices else None,
                "price_change_pct": (
                    ((raw_prices[-1] - raw_prices[0]) / raw_prices[0] * 100)
                    if raw_prices and raw_prices[0] != 0
                    else None
                ),
                "normalized_values": normalized,
            })

        correlations = []
        for i in range(len(series_data)):
            for j in range(i + 1, len(series_data)):
                r = _pearson(
                    series_data[i]["normalized_values"],
                    series_data[j]["normalized_values"],
                )
                correlations.append({
                    "pair": f"{series_data[i]['coin_id']}/{series_data[j]['coin_id']}",
                    "correlation": round(r, 4) if r is not None else None,
                })

        for s in series_data:
            del s["normalized_values"]

        output = {
            "method": method,
            "days": days,
            "series": series_data,
            "correlations": correlations,
        }
        return json.dumps(output, indent=2)


class GetNewsInput(BaseModel):
    coins: str = Field(
        "",
        description="Comma-separated coin symbols to filter news, e.g. 'BTC,XRP'. Leave empty for all crypto news.",
    )
    limit: int = Field(
        10,
        description="Number of articles to retrieve (1-20). Default 10.",
    )

    @field_validator("limit", mode="before")
    @classmethod
    def coerce_limit(cls, v: object) -> int:
        try:
            return int(v)
        except (TypeError, ValueError):
            return 10


class GetNewsTool(BaseTool):
    name: str = "get_news"
    description: str = (
        "Get the latest cryptocurrency news articles. Optionally filter by "
        "coin symbols like BTC, XRP, ETH. Returns article titles, sources, "
        "publication times, and related coins. Use this to reference current "
        "market news and sentiment when answering questions about market conditions."
    )
    args_schema: Type[BaseModel] = GetNewsInput

    def _run(self, coins: str = "", limit: int = 10) -> str:
        """Fetch news synchronously by running the async function."""
        coin_list = [c.strip() for c in coins.split(",") if c.strip()] if coins else None
        articles = _run_async(get_news(coin_list, min(limit, 20)))
        if not articles:
            return "No recent news articles found."
        lines = []
        for i, a in enumerate(articles, 1):
            coins_str = ", ".join(a.get("related_coins", []))
            source = a.get("source", "Unknown")
            body = a.get("body", "")[:200].strip()
            url = a.get("url", "")
            lines.append(
                f"{i}. {a['title']} ({source}, {coins_str})\n"
                f"   URL: {url}\n"
                f"   {body}"
            )
        return "\n\n".join(lines)


class GetSentimentInput(BaseModel):
    coins: str = Field(
        ...,
        description="Comma-separated CoinGecko coin IDs, e.g. 'bitcoin,ripple'",
    )


class GetSentimentTool(BaseTool):
    name: str = "get_sentiment"
    description: str = (
        "Get the current market sentiment for one or more cryptocurrencies. "
        "Returns a sentiment score from -1 (very bearish) to +1 (very bullish), "
        "trend direction (improving/declining/stable), article count analyzed, "
        "and the most bullish and bearish headlines. Use CoinGecko IDs like "
        "'bitcoin', 'ripple', 'ethereum', 'solana', 'dogecoin'."
    )
    args_schema: Type[BaseModel] = GetSentimentInput

    def _run(self, coins: str) -> str:
        """Fetch sentiment summaries synchronously."""
        import asyncio as _asyncio

        coin_list = [c.strip() for c in coins.split(",") if c.strip()]

        async def _fetch_all() -> list[dict]:
            return await _asyncio.gather(
                *[compute_sentiment_summary(c) for c in coin_list]
            )

        results = _run_async(_fetch_all())
        lines = []
        for r in results:
            label = "Bullish" if r["score"] > 0.1 else "Bearish" if r["score"] < -0.1 else "Neutral"
            line = (
                f"{r['coin'].title()}: sentiment {r['score']:+.2f} ({label}, {r['trend']}), "
                f"{r['article_count']} articles analyzed"
            )
            if r.get("top_bullish"):
                line += f"\n  Most bullish: {r['top_bullish']}"
            if r.get("top_bearish"):
                line += f"\n  Most bearish: {r['top_bearish']}"
            lines.append(line)
        return "\n\n".join(lines)
