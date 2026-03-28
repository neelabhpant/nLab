"""Retail Intelligence API endpoints."""

import json
import logging
from typing import Any

import asyncio

from fastapi import APIRouter, Query
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

from app.models.retail import (
    load_articles,
    load_sources,
    get_article,
    update_article,
    update_source,
    load_digest,
    list_digest_dates,
)
from app.services.retail_feed import fetch_all_sources
from app.services.retail_summarizer import batch_summarize
from app.services.retail_digest import generate_daily_digest, get_digest_for_date
from app.services.retail_chat import stream_retail_chat
from app.services.retail_report import stream_report, get_structured_report
from app.services.retail_newsletter import (
    generate_sparks_pdf,
    get_newsletter_path,
    send_newsletter_email,
)
from app.services.retail_memory import RetailMemory

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/retail", tags=["retail"])

_retail_memory: RetailMemory | None = None


def init_retail_memory(memory: RetailMemory | None) -> None:
    global _retail_memory
    _retail_memory = memory


class FetchRequest(BaseModel):
    tier: str | None = None


class ChatRequest(BaseModel):
    message: str


class SourceUpdateRequest(BaseModel):
    enabled: bool | None = None
    fetch_interval_minutes: int | None = None


class NewsletterGenerateRequest(BaseModel):
    spark_ids: list[str] | None = None
    top_n: int = 10


class NewsletterSendRequest(BaseModel):
    file_id: str
    recipients: list[str]
    subject: str = "Retail AI Use Case Sparks — Weekly Newsletter"
    body: str = ""


@router.get("/digest")
async def get_digest(date: str | None = None) -> dict[str, Any]:
    digest = await get_digest_for_date(date)
    if digest:
        return {"digest": digest.model_dump()}
    return {"digest": None, "message": "No digest available for this date"}


@router.post("/digest/refresh")
async def refresh_digest() -> dict[str, Any]:
    digest = await generate_daily_digest(force=True)
    return {"digest": digest.model_dump()}


@router.get("/digest/dates")
async def get_digest_dates(limit: int = Query(30, ge=1, le=100)) -> dict[str, Any]:
    dates = list_digest_dates(limit)
    return {"dates": dates}


@router.get("/articles")
async def list_articles(
    source_id: str | None = None,
    tag: str | None = None,
    bookmarked: bool | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> dict[str, Any]:
    articles = load_articles(
        source_id=source_id,
        tag=tag,
        bookmarked=bookmarked,
        limit=limit,
        offset=offset,
    )
    return {"articles": articles, "count": len(articles)}


@router.get("/articles/{article_id}")
async def get_article_detail(article_id: str) -> dict[str, Any]:
    article = get_article(article_id)
    if not article:
        return {"error": "Article not found"}
    return {"article": article}


@router.post("/articles/{article_id}/bookmark")
async def toggle_bookmark(article_id: str) -> dict[str, Any]:
    article = get_article(article_id)
    if not article:
        return {"error": "Article not found"}
    new_val = not article.get("is_bookmarked", False)
    updated = update_article(article_id, {"is_bookmarked": new_val})
    return {"article": updated}


@router.post("/articles/{article_id}/read")
async def mark_read(article_id: str) -> dict[str, Any]:
    updated = update_article(article_id, {"is_read": True})
    if not updated:
        return {"error": "Article not found"}
    return {"article": updated}


@router.post("/articles/fetch")
async def fetch_articles(req: FetchRequest | None = None) -> dict[str, Any]:
    from app.models.retail import SourceTier, Article

    tier = None
    if req and req.tier:
        try:
            tier = SourceTier(req.tier)
        except ValueError:
            pass

    articles = await fetch_all_sources(tier=tier)
    unsummarized = [a for a in articles if not a.summary][:10]
    if unsummarized:
        summarized = await batch_summarize(unsummarized, max_concurrent=3)
        if _retail_memory and _retail_memory.available:
            for a in summarized:
                if a.summary:
                    _retail_memory.embed_article(
                        article_id=a.id,
                        title=a.title,
                        source_id=a.source_id,
                        summary=a.summary or "",
                        tags=a.tags,
                        sparks=[s.model_dump() for s in a.use_case_sparks],
                        relevance_score=a.relevance_score,
                    )

    return {
        "fetched": len(articles),
        "summarized": len(unsummarized),
        "message": f"Fetched {len(articles)} articles, summarized {len(unsummarized)} new",
    }


@router.get("/sparks")
async def list_sparks(limit: int = Query(20, ge=1, le=100)) -> dict[str, Any]:
    articles = load_articles(limit=200)
    all_sparks: list[dict] = []
    for a in articles:
        for spark in a.get("use_case_sparks", []):
            spark_copy = dict(spark)
            spark_copy["article_title"] = a.get("title", "")
            spark_copy["article_id"] = a.get("id", "")
            spark_copy["source_id"] = a.get("source_id", "")
            all_sparks.append(spark_copy)

    all_sparks.sort(key=lambda s: s.get("confidence", 0), reverse=True)
    return {"sparks": all_sparks[:limit]}


@router.get("/sources")
async def list_sources() -> dict[str, Any]:
    sources = load_sources()
    return {"sources": sources}


@router.put("/sources/{source_id}")
async def update_source_config(source_id: str, req: SourceUpdateRequest) -> dict[str, Any]:
    updates: dict[str, Any] = {}
    if req.enabled is not None:
        updates["enabled"] = req.enabled
    if req.fetch_interval_minutes is not None:
        updates["fetch_interval_minutes"] = req.fetch_interval_minutes

    updated = update_source(source_id, updates)
    if not updated:
        return {"error": "Source not found"}
    return {"source": updated}


@router.post("/chat")
async def retail_chat(req: ChatRequest):
    return StreamingResponse(
        stream_retail_chat(req.message, memory=_retail_memory),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/report")
async def generate_report(date: str | None = None):
    return StreamingResponse(
        stream_report(date),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/report/structured")
async def get_report_structured(date: str | None = None) -> dict[str, Any]:
    report = await get_structured_report(date)
    if not report:
        return {"error": "No digest available or report generation failed"}
    return {"report": report}


@router.get("/search")
async def search_retail(q: str = Query(..., min_length=2)) -> dict[str, Any]:
    if not _retail_memory or not _retail_memory.available:
        return {"results": [], "message": "Semantic search unavailable — no OpenAI API key"}
    results = await asyncio.to_thread(_retail_memory.search, q, 10)
    return {"results": results}


@router.post("/newsletter/generate")
async def generate_newsletter(req: NewsletterGenerateRequest | None = None) -> dict[str, Any]:
    articles = load_articles(limit=200)
    all_sparks: list[dict] = []
    for a in articles:
        for spark in a.get("use_case_sparks", []):
            spark_copy = dict(spark)
            spark_copy["article_title"] = a.get("title", "")
            spark_copy["article_id"] = a.get("id", "")
            spark_copy["source_id"] = a.get("source_id", "")
            all_sparks.append(spark_copy)

    all_sparks.sort(key=lambda s: s.get("confidence", 0), reverse=True)

    top_n = req.top_n if req else 10
    if req and req.spark_ids:
        selected = [s for s in all_sparks if s.get("title") in req.spark_ids or s.get("article_id") in req.spark_ids]
        if not selected:
            selected = all_sparks[:top_n]
    else:
        selected = all_sparks[:top_n]

    if not selected:
        return {"error": "No sparks available to generate newsletter"}

    file_id, _ = await asyncio.to_thread(generate_sparks_pdf, selected)
    return {"file_id": file_id, "spark_count": len(selected)}


@router.get("/newsletter/download/{file_id}")
async def download_newsletter(file_id: str):
    path = get_newsletter_path(file_id)
    if not path or not path.exists():
        return {"error": "Newsletter file not found"}
    pdf_bytes = path.read_bytes()
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{path.name}"'},
    )


@router.post("/newsletter/send")
async def send_newsletter(req: NewsletterSendRequest) -> dict[str, Any]:
    path = get_newsletter_path(req.file_id)
    if not path or not path.exists():
        return {"error": "Newsletter file not found. Generate it first."}
    pdf_bytes = path.read_bytes()
    result = await asyncio.to_thread(
        send_newsletter_email,
        pdf_bytes,
        req.recipients,
        req.subject,
        req.body,
    )
    return {"message": result}
