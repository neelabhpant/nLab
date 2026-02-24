"""AI-powered correlation analysis using CrewAI agents."""

import asyncio
import logging
import time

from cachetools import TTLCache

from app.services.llm import get_llm
from crewai import Agent, Crew, Process, Task
from app.services.tools import CompareAssetsTool, GetCurrentPriceTool, GetSentimentTool

logger = logging.getLogger(__name__)

_analysis_cache: TTLCache[str, dict] = TTLCache(maxsize=32, ttl=1800)


def _build_correlation_crew(coins: list[str], days: int) -> Crew:
    """Build a crew for analyzing price correlation."""
    llm = get_llm()

    compare_tool = CompareAssetsTool()
    price_tool = GetCurrentPriceTool()
    sentiment_tool = GetSentimentTool()

    analysis_agent = Agent(
        role="Quantitative Crypto Analyst",
        goal="Analyze price correlations and comparative performance between crypto assets",
        backstory=(
            "You are a quantitative analyst specializing in cryptocurrency markets. "
            "You use normalized price comparisons, Pearson correlation analysis, and "
            "trend identification to provide rigorous data-driven insights."
        ),
        tools=[compare_tool, price_tool, sentiment_tool],
        llm=llm,
        verbose=False,
    )

    advisor_agent = Agent(
        role="Financial Advisor",
        goal="Translate quantitative analysis into clear, practical insights for retail investors",
        backstory=(
            "You are an experienced financial advisor who explains complex market "
            "data in plain English. You focus on what matters to retail investors: "
            "which asset outperformed, what the correlation means practically, and "
            "any notable divergences."
        ),
        tools=[],
        llm=llm,
        verbose=False,
    )

    coin_names = ", ".join(coins)

    analysis_task = Task(
        description=(
            f"Use compare_assets with coin_ids='{','.join(coins)}', days={days}, method='minmax' "
            f"to get normalized data and correlation. Also use get_current_price for current prices."
        ),
        expected_output="Raw comparison data with correlation coefficients and price changes.",
        agent=analysis_agent,
    )

    summary_task = Task(
        description=(
            f"Based on the analysis data from the previous agent about {coin_names} over {days} days, "
            f"write exactly 3-4 concise sentences explaining:\n"
            f"1. Which asset outperformed and by how much\n"
            f"2. Whether the correlation is significant and what it means practically\n"
            f"3. Any notable divergences or convergences in the period\n\n"
            f"Write in plain English for a retail investor. Be specific with numbers. "
            f"Do NOT use markdown headers, bullet points, or formatting — write in flowing prose only. "
            f"Do NOT include disclaimers or caveats."
        ),
        expected_output="A concise 3-4 sentence correlation analysis in plain prose.",
        agent=advisor_agent,
    )

    return Crew(
        agents=[analysis_agent, advisor_agent],
        tasks=[analysis_task, summary_task],
        process=Process.sequential,
        verbose=False,
    )


async def get_correlation_analysis(coins: list[str], days: int) -> dict:
    """Generate or return cached AI correlation analysis.

    Args:
        coins: List of CoinGecko coin IDs.
        days: Number of days for the comparison window.

    Returns:
        Dict with content and generated_at timestamp.
    """
    cache_key = f"{','.join(sorted(coins))}:{days}"
    if cache_key in _analysis_cache:
        return _analysis_cache[cache_key]

    crew = _build_correlation_crew(coins, days)
    result = await asyncio.to_thread(crew.kickoff)

    analysis = {
        "content": str(result),
        "coins": coins,
        "days": days,
        "generated_at": int(time.time()),
    }

    _analysis_cache[cache_key] = analysis
    return analysis


def invalidate_analysis_cache(coins: list[str], days: int) -> None:
    """Clear a specific analysis from cache."""
    cache_key = f"{','.join(sorted(coins))}:{days}"
    _analysis_cache.pop(cache_key, None)
