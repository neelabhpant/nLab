"""Retail feed ingestion — RSS parsing and article text extraction."""

import asyncio
import logging
from datetime import datetime, timezone
from hashlib import sha256

import feedparser
import httpx
from cachetools import TTLCache
from lxml.html.clean import Cleaner
from lxml import html as lxml_html

from app.models.retail import (
    Article,
    RetailSource,
    SourceTier,
    load_sources,
    merge_new_articles,
    update_source,
)

logger = logging.getLogger(__name__)

_feed_cache: TTLCache[str, list[Article]] = TTLCache(maxsize=24, ttl=3600)

FETCH_TIMEOUT = 15.0
ARTICLE_FETCH_DELAY = 2.0
MAX_CONTENT_LENGTH = 5000

_cleaner = Cleaner(
    scripts=True,
    javascript=True,
    comments=True,
    style=True,
    links=False,
    page_structure=False,
    forms=True,
    annoying_tags=True,
    remove_tags=["img", "video", "audio", "iframe", "figure", "figcaption", "nav", "footer", "header", "aside"],
    remove_unknown_tags=False,
)


def _parse_pub_date(entry: dict) -> str | None:
    pub = entry.get("published_parsed") or entry.get("updated_parsed")
    if pub:
        try:
            dt = datetime(*pub[:6], tzinfo=timezone.utc)
            return dt.isoformat()
        except (ValueError, TypeError):
            pass
    return None


def _article_id_from_url(url: str) -> str:
    return sha256(url.encode()).hexdigest()[:16]


def _extract_image_url(entry: dict) -> str | None:
    try:
        thumbs = getattr(entry, "media_thumbnail", None) or entry.get("media_thumbnail", [])
        if thumbs and isinstance(thumbs, list) and thumbs[0].get("url"):
            return thumbs[0]["url"]
    except Exception:
        pass

    try:
        media = getattr(entry, "media_content", None) or entry.get("media_content", [])
        if media and isinstance(media, list):
            for m in media:
                mtype = m.get("type", "")
                if "image" in mtype or m.get("url", "").lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
                    return m["url"]
    except Exception:
        pass

    try:
        enclosures = getattr(entry, "enclosures", None) or entry.get("enclosures", [])
        if enclosures and isinstance(enclosures, list):
            for enc in enclosures:
                etype = enc.get("type", "")
                if "image" in etype or enc.get("href", "").lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
                    return enc.get("href") or enc.get("url")
    except Exception:
        pass

    try:
        summary_html = entry.get("summary", entry.get("description", ""))
        if summary_html and "<img" in str(summary_html):
            doc = lxml_html.fromstring(str(summary_html))
            imgs = doc.xpath("//img/@src")
            if imgs:
                return imgs[0]
    except Exception:
        pass

    try:
        links = entry.get("links", [])
        if links and isinstance(links, list):
            for link in links:
                ltype = link.get("type", "")
                if "image" in ltype:
                    return link.get("href")
    except Exception:
        pass

    return None


def _extract_text_from_html(html_content: str) -> str:
    try:
        doc = lxml_html.fromstring(html_content)
        cleaned = _cleaner.clean_html(doc)
        text = cleaned.text_content()
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        return "\n".join(lines)[:MAX_CONTENT_LENGTH]
    except Exception:
        return ""


async def _fetch_full_text(url: str, client: httpx.AsyncClient) -> str | None:
    try:
        resp = await client.get(
            url,
            timeout=FETCH_TIMEOUT,
            follow_redirects=True,
            headers={"User-Agent": "nLab-RetailIntel/1.0 (research bot)"},
        )
        resp.raise_for_status()
        content_type = resp.headers.get("content-type", "")
        if "html" not in content_type:
            return None
        text = _extract_text_from_html(resp.text)
        return text if len(text) > 100 else None
    except Exception as e:
        logger.debug("Full text extraction failed for %s: %s", url, e)
        return None


async def fetch_source(source: RetailSource) -> list[Article]:
    cache_key = source.id
    if cache_key in _feed_cache:
        return _feed_cache[cache_key]

    articles: list[Article] = []
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                source.url,
                timeout=FETCH_TIMEOUT,
                headers={"User-Agent": "nLab-RetailIntel/1.0 (research bot)"},
                follow_redirects=True,
            )
            resp.raise_for_status()

        feed = feedparser.parse(resp.text)

        for entry in feed.entries[:20]:
            url = entry.get("link", "")
            if not url:
                continue

            description = entry.get("summary", entry.get("description", ""))
            if hasattr(description, "__str__"):
                description = str(description)
            plain_desc = _extract_text_from_html(description) if "<" in description else description

            article = Article(
                id=_article_id_from_url(url),
                source_id=source.id,
                title=entry.get("title", ""),
                url=url,
                published_at=_parse_pub_date(entry),
                raw_content=plain_desc[:MAX_CONTENT_LENGTH] if plain_desc else None,
                image_url=_extract_image_url(entry),
            )
            articles.append(article)

        _feed_cache[cache_key] = articles
        update_source(source.id, {"last_fetched": datetime.now(timezone.utc).isoformat()})

    except Exception as e:
        logger.warning("Failed to fetch source %s: %s", source.id, e)

    return articles


async def fetch_all_sources(tier: SourceTier | None = None) -> list[Article]:
    raw_sources = load_sources()
    sources = []
    for s in raw_sources:
        try:
            src = RetailSource(**s)
            if not src.enabled:
                continue
            if tier and src.tier != tier:
                continue
            sources.append(src)
        except Exception:
            continue

    tasks = [fetch_source(s) for s in sources]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    all_articles: list[Article] = []
    for result in results:
        if isinstance(result, list):
            all_articles.extend(result)

    added = merge_new_articles(all_articles)
    logger.info("Fetched %d articles, %d new", len(all_articles), added)
    return all_articles


async def fetch_full_text_for_articles(articles: list[Article], max_articles: int = 5) -> list[Article]:
    async with httpx.AsyncClient() as client:
        for article in articles[:max_articles]:
            if article.raw_content and len(article.raw_content) > 200:
                continue
            full_text = await _fetch_full_text(article.url, client)
            if full_text:
                article.raw_content = full_text
            await asyncio.sleep(ARTICLE_FETCH_DELAY)
    return articles
