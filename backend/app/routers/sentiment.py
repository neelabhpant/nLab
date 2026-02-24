"""Sentiment analysis endpoints."""

import asyncio

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.services.sentiment import compute_daily_sentiment, compute_sentiment_summary

router = APIRouter(tags=["sentiment"])


class DailyScore(BaseModel):
    """Sentiment data for a single day."""

    date: str
    score: float
    article_count: int


class CoinHeatmapData(BaseModel):
    """Heatmap row for one coin."""

    coin: str
    days: list[DailyScore]


class HeatmapResponse(BaseModel):
    """Full heatmap grid response."""

    coins: list[CoinHeatmapData]


class SentimentSummaryItem(BaseModel):
    """Sentiment summary for one coin."""

    coin: str
    score: float
    trend: str
    article_count: int
    top_bullish: str | None = None
    top_bearish: str | None = None


class SentimentSummaryResponse(BaseModel):
    """Response containing sentiment summaries."""

    summaries: list[SentimentSummaryItem]


@router.get("/sentiment/heatmap", response_model=HeatmapResponse)
async def sentiment_heatmap(
    coins: str = Query("bitcoin,ripple,ethereum,solana,dogecoin"),
    days: int = Query(30, ge=7, le=90),
) -> HeatmapResponse:
    """Get sentiment heatmap grid data for multiple coins."""
    try:
        coin_list = [c.strip() for c in coins.split(",") if c.strip()]
        results = await asyncio.gather(
            *[compute_daily_sentiment(coin, days) for coin in coin_list]
        )
        grid = []
        for coin, daily_data in zip(coin_list, results):
            grid.append(CoinHeatmapData(
                coin=coin,
                days=[DailyScore(**d) for d in daily_data],
            ))
        return HeatmapResponse(coins=grid)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/sentiment/summary", response_model=SentimentSummaryResponse)
async def sentiment_summary(
    coins: str = Query("bitcoin,ripple"),
) -> SentimentSummaryResponse:
    """Get current sentiment summary for each coin."""
    try:
        coin_list = [c.strip() for c in coins.split(",") if c.strip()]
        results = await asyncio.gather(
            *[compute_sentiment_summary(coin) for coin in coin_list]
        )
        return SentimentSummaryResponse(
            summaries=[SentimentSummaryItem(**r) for r in results]
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
