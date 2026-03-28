"""Retail background scheduler — periodic feed fetching and processing."""

import asyncio
import logging
from datetime import datetime, timezone

from app.models.retail import RetailSource, SourceTier, load_sources
from app.services.retail_feed import fetch_source, fetch_full_text_for_articles
from app.services.retail_summarizer import batch_summarize

logger = logging.getLogger(__name__)

CHECK_INTERVAL = 300
ACTIVE_HOURS = (6, 22)

_scheduler_task: asyncio.Task | None = None


def _should_fetch(source: RetailSource, now: datetime) -> bool:
    if not source.enabled:
        return False
    if not source.last_fetched:
        return True
    try:
        last = datetime.fromisoformat(source.last_fetched)
        elapsed_minutes = (now - last).total_seconds() / 60
        return elapsed_minutes >= source.fetch_interval_minutes
    except (ValueError, TypeError):
        return True


async def _run_fetch_cycle() -> None:
    now = datetime.now(timezone.utc)
    hour = now.hour

    if hour < ACTIVE_HOURS[0] or hour >= ACTIVE_HOURS[1]:
        return

    raw_sources = load_sources()
    sources: list[RetailSource] = []
    for s in raw_sources:
        try:
            src = RetailSource(**s)
            if _should_fetch(src, now):
                sources.append(src)
        except Exception:
            continue

    if not sources:
        return

    logger.info("Scheduler: fetching %d sources", len(sources))
    for source in sources:
        try:
            articles = await fetch_source(source)
            unsummarized = [a for a in articles if not a.summary]
            if unsummarized:
                await fetch_full_text_for_articles(unsummarized, max_articles=3)
                await batch_summarize(unsummarized[:5], max_concurrent=2)
        except Exception as e:
            logger.warning("Scheduler: failed to process source %s: %s", source.id, e)


async def _scheduler_loop() -> None:
    logger.info("Retail scheduler started")
    while True:
        try:
            await _run_fetch_cycle()
        except Exception as e:
            logger.warning("Scheduler cycle failed: %s", e)
        await asyncio.sleep(CHECK_INTERVAL)


def start_scheduler() -> None:
    global _scheduler_task
    if _scheduler_task is None or _scheduler_task.done():
        _scheduler_task = asyncio.create_task(_scheduler_loop())
        logger.info("Retail scheduler task created")


def stop_scheduler() -> None:
    global _scheduler_task
    if _scheduler_task and not _scheduler_task.done():
        _scheduler_task.cancel()
        logger.info("Retail scheduler stopped")
    _scheduler_task = None
