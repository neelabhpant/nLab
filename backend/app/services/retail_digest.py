"""Retail daily digest — aggregation + LLM theme synthesis."""

import asyncio
import json
import logging
from datetime import datetime, timezone

from cachetools import TTLCache
from litellm import completion as litellm_completion

from app.models.retail import (
    Article,
    DailyDigest,
    UseCaseSpark,
    load_articles,
    load_digest,
    save_digest,
)
from app.services.retail_summarizer import (
    get_retail_llm_settings,
    _retail_litellm_model,
)

logger = logging.getLogger(__name__)

_digest_cache: TTLCache[str, dict] = TTLCache(maxsize=7, ttl=3600)

_NO_TEMPERATURE_MODELS = {"gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-5.2"}

DIGEST_SYSTEM_PROMPT = """You are a retail industry strategist advising a Director of AI Industry Solutions at Cloudera.

Given summaries of today's retail articles, produce:

1. top_theme: A sharp, specific, timely theme statement.
   BAD: "Data-Driven Retail Transformation" (generic, any day)
   BAD: "AI in Retail" (too broad)
   GOOD: "Retailers Racing to Deploy AI Agents as Walmart's Sparky Proves Revenue Impact" (specific, timely, actionable)
   GOOD: "Tariff Volatility Drives Urgent Need for Real-Time Supply Chain Visibility" (ties to infrastructure need)

2. theme_summary: 2-3 sentences explaining what this theme means specifically for enterprise data platform and AI infrastructure adoption in retail. Must connect the trend to a concrete technology need that Cloudera addresses.
   BAD: "Retailers are adopting AI to improve operations."
   GOOD: "This week's Walmart Sparky results prove that AI agents drive measurable revenue lift, but scaling agents across channels requires real-time data unification and hybrid deployment that cloud-only platforms cannot deliver. Retailers evaluating agentic commerce need infrastructure that bridges in-store edge computing with cloud-based model training."

3. top_article_indices: Indices (0-based) of the 3 most actionable articles for someone selling AI data platform solutions to Fortune 500 retailers. Prioritize articles that reveal data/AI infrastructure needs over general business news.

Respond ONLY in valid JSON. No preamble, no markdown fences."""

DIGEST_USER_TEMPLATE = """ARTICLES:
{articles_context}

Return ONLY valid JSON:
{{
  "top_theme": "Sharp, specific theme tied to today's articles",
  "theme_summary": "2-3 sentences connecting theme to enterprise data/AI platform needs",
  "top_article_ids": ["id1", "id2", "id3"]
}}"""


def _synthesize_theme(articles_context: str) -> dict:
    user_prompt = DIGEST_USER_TEMPLATE.format(articles_context=articles_context)
    settings = get_retail_llm_settings()
    model_string = _retail_litellm_model(settings)
    model_name = settings["model"]

    kwargs: dict = {
        "model": model_string,
        "messages": [
            {"role": "system", "content": DIGEST_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "api_key": settings["api_key"],
        "max_completion_tokens": 500,
    }
    if model_name not in _NO_TEMPERATURE_MODELS:
        kwargs["temperature"] = 0.3

    response = litellm_completion(**kwargs)
    raw = response.choices[0].message.content.strip()
    start = raw.find("{")
    end = raw.rfind("}") + 1
    if start < 0 or end <= start:
        return {"top_theme": "Retail Industry Update", "theme_summary": raw[:300], "top_article_ids": []}
    return json.loads(raw[start:end])


async def generate_daily_digest(force: bool = False) -> DailyDigest:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    if not force and today in _digest_cache:
        return DailyDigest(**_digest_cache[today])

    if not force:
        existing = load_digest(today)
        if existing:
            _digest_cache[today] = existing
            return DailyDigest(**existing)

    raw_articles = load_articles(limit=100)
    today_articles: list[dict] = []
    for a in raw_articles:
        fetched = a.get("fetched_at", "")
        if fetched.startswith(today) or len(today_articles) < 15:
            if a.get("summary"):
                today_articles.append(a)

    today_articles.sort(key=lambda x: x.get("relevance_score") or 0, reverse=True)
    today_articles = today_articles[:15]

    if not today_articles:
        digest = DailyDigest(
            date=today,
            articles=[],
            top_theme="No articles available",
            theme_summary="No articles have been fetched yet. Try fetching sources first.",
            article_count=0,
        )
        save_digest(digest)
        return digest

    context_lines: list[str] = []
    for a in today_articles:
        line = f"[{a.get('id', '')}] {a.get('title', '')} (Source: {a.get('source_id', '')})"
        summary = a.get("summary", "")
        if summary:
            line += f"\n  Summary: {summary}"
        tags = a.get("tags", [])
        if tags:
            line += f"\n  Tags: {', '.join(tags)}"
        context_lines.append(line)

    articles_context = "\n\n".join(context_lines)

    try:
        synthesis = await asyncio.to_thread(_synthesize_theme, articles_context)
    except Exception as e:
        logger.warning("Digest synthesis failed: %s", e)
        synthesis = {"top_theme": "Retail Industry Update", "theme_summary": "Digest synthesis unavailable.", "top_article_ids": []}

    all_sparks: list[UseCaseSpark] = []
    source_breakdown: dict[str, int] = {}
    for a in today_articles:
        src = a.get("source_id", "unknown")
        source_breakdown[src] = source_breakdown.get(src, 0) + 1
        for spark_data in a.get("use_case_sparks", []):
            try:
                all_sparks.append(UseCaseSpark(**spark_data))
            except Exception:
                continue

    seen_titles: set[str] = set()
    deduped_sparks: list[UseCaseSpark] = []
    for spark in sorted(all_sparks, key=lambda s: s.confidence, reverse=True):
        key = spark.title.lower().strip()
        if key not in seen_titles:
            seen_titles.add(key)
            deduped_sparks.append(spark)

    digest = DailyDigest(
        date=today,
        articles=[Article(**a) for a in today_articles],
        top_theme=synthesis.get("top_theme", "Retail Industry Update"),
        theme_summary=synthesis.get("theme_summary", ""),
        use_case_sparks=deduped_sparks[:10],
        article_count=len(today_articles),
        source_breakdown=source_breakdown,
    )

    save_digest(digest)
    _digest_cache[today] = digest.model_dump()
    return digest


async def get_digest_for_date(date: str | None = None) -> DailyDigest | None:
    if date is None:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    data = load_digest(date)
    if data:
        return DailyDigest(**data)
    return None


def invalidate_digest_cache() -> None:
    _digest_cache.clear()
