"""Retail Intelligence Report — LLM-generated executive briefing."""

import asyncio
import json
import logging
from collections.abc import AsyncGenerator
from datetime import datetime, timezone

from litellm import completion as litellm_completion

from app.models.retail import load_digest
from app.services.retail_summarizer import (
    get_retail_llm_settings,
    _retail_litellm_model,
)

logger = logging.getLogger(__name__)

_NO_TEMPERATURE_MODELS = {"gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-5.2"}

REPORT_SYSTEM_PROMPT = """You are a senior retail industry strategist writing an executive briefing for Account Executives selling enterprise data and AI platform solutions to Fortune 500 retailers.

Write a polished, professional Markdown report that an AE can forward directly to their manager or share in a team meeting. The report should demonstrate deep retail industry knowledge and connect trends to specific technology opportunities.

## REPORT STRUCTURE

# Retail Intelligence Briefing — {date}

## Executive Summary
2-3 paragraph overview of the day's most important retail trends and what they mean for enterprise data/AI platform sales. This should be punchy and insightful — not a list of headlines.

## Key Theme: {theme}
Expand on the day's top theme with strategic analysis. Connect to specific customer conversations and deal opportunities. 2-3 paragraphs.

## Top Stories & Analysis
For each of the top 3-5 articles, write a brief analysis (2-3 sentences) focused on the data/AI infrastructure implications. Format as:
### [Article Title]
**Source:** source name | **Relevance:** score/100
Analysis paragraph connecting the story to enterprise technology needs.

## Use Case Opportunities
For the top 3-5 use case sparks, present them as actionable talking points:
### [Use Case Title] (Confidence: X%)
**The Problem:** retail problem description
**The Solution:** description with Cloudera capabilities
**Architecture:** architecture flow
**Why We Win:** competitive advantage

## Recommended Actions
3-5 bullet points of specific actions the AE should take based on today's intelligence (e.g., "Reach out to [type of retailer] about [specific capability]", "Prepare demo of [product] for [use case]").

## FORMATTING RULES
- Use proper Markdown with headers, bold, bullet points
- Be specific and actionable — no filler or generic statements
- Write for a senior sales professional, not a technical audience
- Keep total length to ~1500-2000 words
- Every section should connect retail trends to technology sales opportunities"""

STRUCTURED_SYSTEM_PROMPT = """You are a senior retail industry strategist writing an executive briefing for Account Executives selling enterprise data and AI platform solutions to Fortune 500 retailers.

Return ONLY valid JSON with this exact structure. No preamble, no markdown fences.

{{
  "executive_summary": "2-3 paragraphs of punchy, insightful overview. Use \\n\\n between paragraphs.",
  "key_theme_analysis": "2-3 paragraphs expanding on the day's top theme with strategic analysis. Connect to customer conversations and deal opportunities. Use \\n\\n between paragraphs.",
  "story_analyses": [
    {{
      "title": "Article title",
      "source": "source name",
      "relevance": 85,
      "analysis": "2-3 sentence analysis connecting the story to enterprise data/AI infrastructure needs."
    }}
  ],
  "use_case_opportunities": [
    {{
      "title": "Use case title",
      "confidence": 82,
      "problem": "The specific data/systems challenge",
      "solution": "Solution with Cloudera capabilities",
      "architecture": "Data flow pipeline",
      "why_we_win": "Competitive advantage over Databricks/Snowflake"
    }}
  ],
  "recommended_actions": [
    "Specific action the AE should take"
  ]
}}

RULES:
- Be specific and actionable — no filler
- Write for a senior sales professional
- 3-5 story analyses, 3-5 use cases, 3-5 actions
- Every section connects retail trends to technology sales opportunities"""

REPORT_USER_TEMPLATE = """Generate the executive briefing report using this intelligence:

DATE: {date}

TODAY'S THEME: {top_theme}
THEME SUMMARY: {theme_summary}

ARTICLES ({article_count} total):
{articles_context}

USE CASE SPARKS:
{sparks_context}

SOURCE BREAKDOWN:
{source_breakdown}

Write the full Markdown report now."""

STRUCTURED_USER_TEMPLATE = """Generate the structured executive briefing using this intelligence:

DATE: {date}

TODAY'S THEME: {top_theme}
THEME SUMMARY: {theme_summary}

ARTICLES ({article_count} total):
{articles_context}

USE CASE SPARKS:
{sparks_context}

SOURCE BREAKDOWN:
{source_breakdown}

Return ONLY valid JSON."""


def _build_report_context(date: str | None = None) -> dict | None:
    if date is None:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    digest_data = load_digest(date)
    if not digest_data:
        return None

    articles = digest_data.get("articles", [])
    sparks = digest_data.get("use_case_sparks", [])

    articles_lines: list[str] = []
    for i, a in enumerate(articles[:15]):
        line = f"[{i+1}] {a.get('title', '')} (Source: {a.get('source_id', '')})"
        if a.get("summary"):
            line += f"\n  Summary: {a['summary']}"
        if a.get("key_takeaways"):
            line += "\n  Takeaways: " + "; ".join(a["key_takeaways"][:3])
        if a.get("tags"):
            line += f"\n  Tags: {', '.join(a['tags'])}"
        score = a.get("relevance_score")
        if score:
            line += f"\n  Relevance: {int(score * 100)}/100"
        articles_lines.append(line)

    sparks_lines: list[str] = []
    for s in sparks[:10]:
        lines = [
            f"- {s.get('title', '')} (Confidence: {int(s.get('confidence', 0) * 100)}%)",
            f"  Problem: {s.get('retail_problem', '')}",
            f"  Solution: {s.get('description', '')}",
        ]
        if s.get("architecture_flow"):
            lines.append(f"  Architecture: {s['architecture_flow']}")
        if s.get("competitive_advantage"):
            lines.append(f"  Why We Win: {s['competitive_advantage']}")
        if s.get("cloudera_capabilities"):
            lines.append(f"  Capabilities: {', '.join(s['cloudera_capabilities'])}")
        sparks_lines.append("\n".join(lines))

    breakdown = digest_data.get("source_breakdown", {})
    breakdown_text = ", ".join(f"{k}: {v} articles" for k, v in breakdown.items()) if breakdown else "N/A"

    return {
        "date": date,
        "top_theme": digest_data.get("top_theme", ""),
        "theme_summary": digest_data.get("theme_summary", ""),
        "article_count": len(articles),
        "articles_context": "\n\n".join(articles_lines),
        "sparks_context": "\n\n".join(sparks_lines) if sparks_lines else "No sparks available.",
        "source_breakdown": breakdown_text,
        "source_breakdown_raw": breakdown,
    }


async def stream_report(date: str | None = None) -> AsyncGenerator[str, None]:
    context = await asyncio.to_thread(_build_report_context, date)
    if not context:
        yield "data: {\"type\": \"error\", \"content\": \"No digest available for this date. Refresh the digest first.\"}\n\n"
        return

    system_prompt = REPORT_SYSTEM_PROMPT.replace("{date}", context["date"]).replace("{theme}", context["top_theme"])
    user_prompt = REPORT_USER_TEMPLATE.format(**context)

    settings = get_retail_llm_settings()
    model_string = _retail_litellm_model(settings)
    model_name = settings["model"]

    kwargs: dict = {
        "model": model_string,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "api_key": settings["api_key"],
        "max_completion_tokens": 4000,
        "stream": True,
    }
    if model_name not in _NO_TEMPERATURE_MODELS:
        kwargs["temperature"] = 0.4

    try:
        response = litellm_completion(**kwargs)
        for chunk in response:
            delta = chunk.choices[0].delta
            if delta and delta.content:
                yield f"data: {json.dumps({'type': 'text_delta', 'content': delta.content})}\n\n"
        yield "data: {\"type\": \"done\"}\n\n"
    except Exception as e:
        logger.warning("Report generation failed: %s", e)
        yield f"data: {json.dumps({'type': 'error', 'content': f'Report generation failed: {str(e)}'})}\n\n"


def _build_structured_from_digest(context: dict) -> dict:
    """Build structured report directly from digest data without an extra LLM call."""
    from app.models.retail import load_digest

    digest_data = load_digest(context["date"])
    if not digest_data:
        raise ValueError("No digest data")

    articles = digest_data.get("articles", [])
    sparks = digest_data.get("use_case_sparks", [])

    story_analyses = []
    for a in articles[:5]:
        score = a.get("relevance_score")
        story_analyses.append({
            "title": a.get("title", ""),
            "source": a.get("source_id", "").replace("_", " ").title(),
            "relevance": int((score or 0) * 100),
            "analysis": a.get("summary", ""),
        })

    use_case_opportunities = []
    for s in sparks[:5]:
        use_case_opportunities.append({
            "title": s.get("title", ""),
            "confidence": int((s.get("confidence", 0)) * 100),
            "problem": s.get("retail_problem", ""),
            "solution": s.get("description", ""),
            "architecture": s.get("architecture_flow", ""),
            "why_we_win": s.get("competitive_advantage", ""),
        })

    return {
        "story_analyses": story_analyses,
        "use_case_opportunities": use_case_opportunities,
    }


def _generate_narrative_sections(context: dict) -> dict:
    """Use LLM to generate only narrative text sections (no JSON structure needed)."""
    settings = get_retail_llm_settings()
    model_string = _retail_litellm_model(settings)
    model_name = settings["model"]

    prompt = f"""Write two sections for a retail intelligence executive briefing for {context['date']}.

TODAY'S THEME: {context['top_theme']}
THEME SUMMARY: {context['theme_summary']}

ARTICLES ({context['article_count']} total):
{context['articles_context'][:3000]}

Write:
1. EXECUTIVE SUMMARY (2-3 paragraphs, punchy overview connecting retail trends to enterprise data/AI platform sales opportunities. Separate paragraphs with blank lines.)
2. KEY THEME ANALYSIS (2-3 paragraphs expanding on the theme with strategic analysis. Separate paragraphs with blank lines.)
3. RECOMMENDED ACTIONS (3-5 specific actions an Account Executive should take, one per line, prefixed with a dash.)

Format your response exactly as:
===EXECUTIVE_SUMMARY===
[your executive summary text]
===KEY_THEME_ANALYSIS===
[your key theme analysis text]
===RECOMMENDED_ACTIONS===
[your recommended actions, one per line with dash prefix]"""

    kwargs: dict = {
        "model": model_string,
        "messages": [
            {"role": "system", "content": "You are a senior retail industry strategist writing for Account Executives selling enterprise data and AI platform solutions. Be specific and actionable."},
            {"role": "user", "content": prompt},
        ],
        "api_key": settings["api_key"],
        "max_completion_tokens": 3000,
    }
    if model_name not in _NO_TEMPERATURE_MODELS:
        kwargs["temperature"] = 0.4

    response = litellm_completion(**kwargs)
    raw = response.choices[0].message.content.strip()

    result: dict = {
        "executive_summary": "",
        "key_theme_analysis": "",
        "recommended_actions": [],
    }

    if "===EXECUTIVE_SUMMARY===" in raw:
        parts = raw.split("===")
        current_key = ""
        for part in parts:
            part = part.strip()
            if part == "EXECUTIVE_SUMMARY":
                current_key = "executive_summary"
            elif part == "KEY_THEME_ANALYSIS":
                current_key = "key_theme_analysis"
            elif part == "RECOMMENDED_ACTIONS":
                current_key = "recommended_actions"
            elif current_key and part:
                if current_key == "recommended_actions":
                    result[current_key] = [line.lstrip("- ").strip() for line in part.strip().split("\n") if line.strip()]
                else:
                    result[current_key] = part.strip()
    else:
        result["executive_summary"] = raw[:1500]
        result["key_theme_analysis"] = context.get("theme_summary", "")
        result["recommended_actions"] = ["Review today's digest and identify top accounts to contact"]

    return result


async def get_structured_report(date: str | None = None) -> dict | None:
    context = await asyncio.to_thread(_build_report_context, date)
    if not context:
        return None

    try:
        digest_sections = _build_structured_from_digest(context)
        narrative = await asyncio.to_thread(_generate_narrative_sections, context)

        report_data = {
            **narrative,
            "story_analyses": digest_sections["story_analyses"],
            "use_case_opportunities": digest_sections["use_case_opportunities"],
            "meta": {
                "date": context["date"],
                "top_theme": context["top_theme"],
                "theme_summary": context["theme_summary"],
                "article_count": context["article_count"],
                "source_breakdown": context.get("source_breakdown_raw", {}),
            },
        }
        return report_data
    except Exception as e:
        logger.warning("Structured report generation failed: %s", e)
        return None
