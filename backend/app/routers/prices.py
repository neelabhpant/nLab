import asyncio
from enum import Enum

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.services.coingecko import get_current_prices, get_historical
from app.services.normalize import min_max_normalize, z_score_normalize

router = APIRouter(tags=["prices"])


class CoinPrice(BaseModel):
    """Current price data for a single coin."""

    coin_id: str
    usd: float | None = None
    usd_24h_change: float | None = None
    usd_market_cap: float | None = None


class PricesResponse(BaseModel):
    """Response containing prices for multiple coins."""

    prices: list[CoinPrice]


class PricePoint(BaseModel):
    """Single timestamped price point."""

    timestamp: int
    price: float


class HistoricalResponse(BaseModel):
    """Response containing historical price data."""

    coin_id: str
    days: int
    prices: list[PricePoint]


class NormMethod(str, Enum):
    """Normalization method selector."""

    minmax = "minmax"
    zscore = "zscore"


class CompareSeriesPoint(BaseModel):
    """Single point in a comparison series with both normalized and original values."""

    timestamp: int
    normalized: float
    usd: float


class CompareSeries(BaseModel):
    """Normalized series for one coin, including original USD values for tooltips."""

    coin_id: str
    points: list[CompareSeriesPoint]


class CompareResponse(BaseModel):
    """Response containing normalized series for multiple coins."""

    method: str
    days: int
    series: list[CompareSeries]


@router.get("/prices", response_model=PricesResponse)
async def fetch_prices(
    coins: str = Query(..., description="Comma-separated CoinGecko coin IDs"),
) -> PricesResponse:
    """Fetch current prices for one or more coins."""
    coin_ids = [c.strip() for c in coins.split(",") if c.strip()]
    if not coin_ids:
        raise HTTPException(status_code=400, detail="No coin IDs provided")
    try:
        data = await get_current_prices(coin_ids)
        return PricesResponse(prices=[CoinPrice(**item) for item in data])
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/historical/{coin_id}", response_model=HistoricalResponse)
async def fetch_historical(
    coin_id: str,
    days: int = Query(30, ge=1, le=365, description="Number of days of history"),
) -> HistoricalResponse:
    """Fetch historical price data for a coin."""
    try:
        data = await get_historical(coin_id, days)
        return HistoricalResponse(
            coin_id=data["coin_id"],
            days=data["days"],
            prices=[PricePoint(**p) for p in data["prices"]],
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/compare", response_model=CompareResponse)
async def compare_coins(
    coins: str = Query(..., description="Comma-separated CoinGecko coin IDs"),
    days: int = Query(30, ge=1, le=365, description="Number of days of history"),
    method: NormMethod = Query(NormMethod.minmax, description="Normalization method"),
) -> CompareResponse:
    """Fetch and normalize historical data for multiple coins for overlay comparison."""
    coin_ids = [c.strip() for c in coins.split(",") if c.strip()]
    if len(coin_ids) < 2:
        raise HTTPException(status_code=400, detail="At least 2 coin IDs required")

    normalize = min_max_normalize if method == NormMethod.minmax else z_score_normalize

    try:
        results = await asyncio.gather(
            *[get_historical(coin_id, days) for coin_id in coin_ids]
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    series: list[CompareSeries] = []
    for hist in results:
        raw_prices = [p["price"] for p in hist["prices"]]
        normalized = normalize(raw_prices)
        points = [
            CompareSeriesPoint(
                timestamp=hist["prices"][i]["timestamp"],
                normalized=normalized[i],
                usd=raw_prices[i],
            )
            for i in range(len(raw_prices))
        ]
        series.append(CompareSeries(coin_id=hist["coin_id"], points=points))

    return CompareResponse(method=method.value, days=days, series=series)
