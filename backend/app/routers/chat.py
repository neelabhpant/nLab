from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from app.services.agent import stream_crew_response
from app.services.market_brief import get_market_brief, invalidate_brief_cache
from app.services.correlation_analysis import get_correlation_analysis, invalidate_analysis_cache

router = APIRouter(tags=["chat"])


class ChatMessage(BaseModel):
    """Single chat message."""

    role: str
    content: str


class ChatRequest(BaseModel):
    """Chat request containing conversation history."""

    messages: list[ChatMessage]


@router.post("/chat", response_model=None)
async def chat(request: ChatRequest) -> StreamingResponse | JSONResponse:
    """Stream a multi-agent crew response via SSE."""
    if not request.messages:
        return JSONResponse(
            status_code=400,
            content={"error": "No messages provided", "detail": "messages array must not be empty"},
        )

    messages_dicts = [m.model_dump() for m in request.messages]

    return StreamingResponse(
        stream_crew_response(messages_dicts),
        media_type="text/event-stream",
    )


class MarketBriefResponse(BaseModel):
    """AI-generated market brief."""

    content: str
    generated_at: int


@router.get("/market-brief", response_model=MarketBriefResponse)
async def market_brief() -> MarketBriefResponse:
    """Get an AI-generated market brief. Cached for 1 hour."""
    try:
        data = await get_market_brief()
        return MarketBriefResponse(**data)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/market-brief/refresh", response_model=MarketBriefResponse)
async def refresh_market_brief() -> MarketBriefResponse:
    """Force regeneration of the market brief."""
    try:
        invalidate_brief_cache()
        data = await get_market_brief()
        return MarketBriefResponse(**data)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


class CorrelationAnalysisResponse(BaseModel):
    """AI-generated correlation analysis."""

    content: str
    coins: list[str]
    days: int
    generated_at: int


@router.get("/analyze-correlation", response_model=CorrelationAnalysisResponse)
async def analyze_correlation(
    coins: str = Query(..., description="Comma-separated CoinGecko coin IDs"),
    days: int = Query(30, description="Number of days"),
) -> CorrelationAnalysisResponse:
    """Get AI-powered correlation analysis. Cached for 30 minutes."""
    coin_list = [c.strip() for c in coins.split(",") if c.strip()]
    if len(coin_list) < 2:
        raise HTTPException(status_code=400, detail="At least 2 coins required")
    try:
        data = await get_correlation_analysis(coin_list, days)
        return CorrelationAnalysisResponse(**data)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/analyze-correlation/refresh", response_model=CorrelationAnalysisResponse)
async def refresh_correlation(
    coins: str = Query(..., description="Comma-separated CoinGecko coin IDs"),
    days: int = Query(30, description="Number of days"),
) -> CorrelationAnalysisResponse:
    """Force regeneration of correlation analysis."""
    coin_list = [c.strip() for c in coins.split(",") if c.strip()]
    if len(coin_list) < 2:
        raise HTTPException(status_code=400, detail="At least 2 coins required")
    try:
        invalidate_analysis_cache(coin_list, days)
        data = await get_correlation_analysis(coin_list, days)
        return CorrelationAnalysisResponse(**data)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
