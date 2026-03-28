"""Pydantic models and JSON persistence for the Retail Intelligence space."""

import json
import logging
from datetime import datetime, timezone
from enum import Enum
from hashlib import sha256
from pathlib import Path
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
SOURCES_PATH = DATA_DIR / "retail_sources.json"
ARTICLES_PATH = DATA_DIR / "retail_articles.json"
DIGESTS_DIR = DATA_DIR / "retail_digests"

MAX_ARTICLES = 500


class SourceTier(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    COMPETITIVE = "competitive"


class FeedType(str, Enum):
    RSS = "rss"
    WEB_SCRAPE = "web_scrape"
    API = "api"


class RetailSource(BaseModel):
    id: str
    name: str
    url: str
    feed_type: FeedType = FeedType.RSS
    tier: SourceTier = SourceTier.DAILY
    enabled: bool = True
    focus: str = ""
    last_fetched: str | None = None
    fetch_interval_minutes: int = 60


class UseCaseSpark(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    title: str
    description: str
    cloudera_capabilities: list[str] = Field(default_factory=list)
    retail_problem: str = ""
    architecture_flow: str = ""
    competitive_advantage: str = ""
    confidence: float = 0.5


class Article(BaseModel):
    id: str = ""
    source_id: str = ""
    title: str = ""
    url: str = ""
    published_at: str | None = None
    fetched_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    raw_content: str | None = None
    summary: str | None = None
    key_takeaways: list[str] = Field(default_factory=list)
    use_case_sparks: list[UseCaseSpark] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    image_url: str | None = None
    is_bookmarked: bool = False
    is_read: bool = False
    relevance_score: float | None = None

    def compute_id(self) -> str:
        return sha256(self.url.encode()).hexdigest()[:16]


class DailyDigest(BaseModel):
    date: str
    generated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    articles: list[Article] = Field(default_factory=list)
    top_theme: str = ""
    theme_summary: str = ""
    use_case_sparks: list[UseCaseSpark] = Field(default_factory=list)
    article_count: int = 0
    source_breakdown: dict[str, int] = Field(default_factory=dict)


def _load_json(path: Path) -> Any:
    if path.exists():
        try:
            return json.loads(path.read_text())
        except (json.JSONDecodeError, OSError):
            logger.warning("Failed to read %s", path)
    return None


def _save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2))


def load_sources() -> list[dict[str, Any]]:
    data = _load_json(SOURCES_PATH)
    if not isinstance(data, list):
        return []
    return data


def save_sources(sources: list[dict[str, Any]]) -> None:
    _save_json(SOURCES_PATH, sources)


def update_source(source_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
    sources = load_sources()
    for s in sources:
        if s.get("id") == source_id:
            s.update(updates)
            _save_json(SOURCES_PATH, sources)
            return s
    return None


def load_articles(
    source_id: str | None = None,
    tag: str | None = None,
    bookmarked: bool | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict[str, Any]]:
    data = _load_json(ARTICLES_PATH)
    if not isinstance(data, list):
        return []
    filtered = data
    if source_id:
        filtered = [a for a in filtered if a.get("source_id") == source_id]
    if tag:
        filtered = [a for a in filtered if tag in a.get("tags", [])]
    if bookmarked is not None:
        filtered = [a for a in filtered if a.get("is_bookmarked") == bookmarked]
    return filtered[offset : offset + limit]


def save_articles(articles: list[dict[str, Any]]) -> None:
    articles = articles[:MAX_ARTICLES]
    _save_json(ARTICLES_PATH, articles)


def get_article(article_id: str) -> dict[str, Any] | None:
    data = _load_json(ARTICLES_PATH)
    if not isinstance(data, list):
        return None
    for a in data:
        if a.get("id") == article_id:
            return a
    return None


def update_article(article_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
    data = _load_json(ARTICLES_PATH)
    if not isinstance(data, list):
        return None
    for a in data:
        if a.get("id") == article_id:
            a.update(updates)
            _save_json(ARTICLES_PATH, data)
            return a
    return None


def merge_new_articles(new_articles: list[Article]) -> int:
    existing = _load_json(ARTICLES_PATH)
    if not isinstance(existing, list):
        existing = []
    existing_ids = {a.get("id") for a in existing}
    added = 0
    for article in new_articles:
        if article.id not in existing_ids:
            existing.insert(0, article.model_dump())
            existing_ids.add(article.id)
            added += 1
    existing = existing[:MAX_ARTICLES]
    _save_json(ARTICLES_PATH, existing)
    return added


def save_digest(digest: DailyDigest) -> dict[str, Any]:
    data = digest.model_dump()
    DIGESTS_DIR.mkdir(parents=True, exist_ok=True)
    path = DIGESTS_DIR / f"{digest.date}.json"
    _save_json(path, data)
    return data


def load_digest(date: str | None = None) -> dict[str, Any] | None:
    if date is None:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    path = DIGESTS_DIR / f"{date}.json"
    return _load_json(path)


def list_digest_dates(limit: int = 30) -> list[str]:
    if not DIGESTS_DIR.exists():
        return []
    files = sorted(DIGESTS_DIR.glob("*.json"), reverse=True)
    return [f.stem for f in files[:limit]]
