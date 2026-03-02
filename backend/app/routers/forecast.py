"""Price forecast API endpoints."""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.services.price_forecast import (
    get_price_forecast,
    invalidate_forecast_cache,
    get_forecast_history,
)

router = APIRouter(tags=["forecast"])


class PriceCase(BaseModel):
    """Price scenario (bull/base/bear)."""

    price: float
    probability: int


class SignalDetail(BaseModel):
    """Individual signal breakdown."""

    direction: str
    confidence: int
    summary: str


class SignalBreakdown(BaseModel):
    """All forecast signals."""

    technical: Optional[SignalDetail] = None
    sentiment: Optional[SignalDetail] = None
    fundamentals: Optional[SignalDetail] = None


class ForecastResponse(BaseModel):
    """Structured price forecast response."""

    coin_id: str
    coin: str
    current_price: float
    horizon_days: int
    bull_case: PriceCase
    base_case: PriceCase
    bear_case: PriceCase
    confidence: int
    direction: str
    signals: SignalBreakdown
    explanation: str
    generated_at: int


class ForecastHistoryItem(BaseModel):
    """Past forecast entry."""

    coin_id: str
    coin: str
    current_price: float
    horizon_days: int
    bull_case: PriceCase
    base_case: PriceCase
    bear_case: PriceCase
    confidence: int
    direction: str
    explanation: str
    generated_at: int


VALID_COINS = ["bitcoin", "ripple", "ethereum", "solana", "dogecoin"]


@router.get("/forecast/{coin_id}", response_model=ForecastResponse)
async def forecast(
    coin_id: str,
    days: int = Query(7, description="Forecast horizon: 7, 14, or 30 days"),
) -> ForecastResponse:
    """Get AI-powered price forecast for a cryptocurrency."""
    if coin_id not in VALID_COINS:
        raise HTTPException(status_code=400, detail=f"Invalid coin. Must be one of: {', '.join(VALID_COINS)}")
    if days not in (7, 14, 30):
        raise HTTPException(status_code=400, detail="Horizon must be 7, 14, or 30 days")
    try:
        data = await get_price_forecast(coin_id, days)
        return ForecastResponse(**data)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/forecast/{coin_id}/refresh", response_model=ForecastResponse)
async def refresh_forecast(
    coin_id: str,
    days: int = Query(7, description="Forecast horizon: 7, 14, or 30 days"),
) -> ForecastResponse:
    """Force regeneration of a price forecast."""
    if coin_id not in VALID_COINS:
        raise HTTPException(status_code=400, detail=f"Invalid coin. Must be one of: {', '.join(VALID_COINS)}")
    if days not in (7, 14, 30):
        raise HTTPException(status_code=400, detail="Horizon must be 7, 14, or 30 days")
    try:
        invalidate_forecast_cache(coin_id, days)
        data = await get_price_forecast(coin_id, days)
        return ForecastResponse(**data)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/forecast/{coin_id}/history")
async def forecast_history(coin_id: str) -> list[dict]:
    """Get past forecasts for accuracy tracking."""
    if coin_id not in VALID_COINS:
        raise HTTPException(status_code=400, detail=f"Invalid coin. Must be one of: {', '.join(VALID_COINS)}")
    return get_forecast_history(coin_id)
