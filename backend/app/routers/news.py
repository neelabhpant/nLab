from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.services.news import get_news

router = APIRouter(tags=["news"])


class NewsArticle(BaseModel):
    """A single news article."""

    title: str
    source: str
    url: str
    published_at: int
    image_url: str
    related_coins: list[str]


class NewsResponse(BaseModel):
    """Response containing a list of news articles."""

    articles: list[NewsArticle]


@router.get("/news", response_model=NewsResponse)
async def fetch_news(
    coins: str | None = Query(None, description="Comma-separated coin symbols, e.g. BTC,XRP"),
    limit: int = Query(20, ge=1, le=50, description="Number of articles to return"),
) -> NewsResponse:
    """Fetch latest crypto news, optionally filtered by coin."""
    try:
        coin_list = [c.strip() for c in coins.split(",") if c.strip()] if coins else None
        data = await get_news(coin_list, limit)
        return NewsResponse(articles=[NewsArticle(**a) for a in data])
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
