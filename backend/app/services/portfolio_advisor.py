"""Portfolio advisor crew — structured questionnaire-driven portfolio recommendation."""

import asyncio
import hashlib
import json
import logging
import time
from collections.abc import AsyncGenerator
from typing import Any

from crewai import Agent, Crew, Process, Task

from app.services.llm import get_llm
from app.services.portfolio_tools import (
    CompareETFsTool,
    GetAssetClassOverviewTool,
    GetEconomicIndicatorsTool,
    GetETFInfoTool,
    GetHistoricalPerformanceTool,
    GetStockQuoteTool,
)
from app.services.tools import (
    GetCurrentPriceTool,
    GetNewsTool,
    GetSentimentTool,
)

logger = logging.getLogger(__name__)

_recommendation_cache: dict[str, tuple[float, dict[str, Any]]] = {}
CACHE_TTL = 3600

SYSTEM_CONTEXT = (
    "You are part of a world-class portfolio advisory team. The user completed "
    "an investor questionnaire. Use their specific answers for highly personalised "
    "recommendations. Include specific fund names, percentages, and dollar amounts "
    "based on their stated monthly investment capacity. Never be generic — every "
    "recommendation should reference their stated goals, timeline, and constraints."
)

STRUCTURED_OUTPUT_PROMPT = """
You MUST respond with ONLY a valid JSON object matching this exact schema. No markdown, no explanation, no text before or after.

{
  "allocation": [
    {"asset_class": "string", "percentage": number, "funds": ["string"], "rationale": "string"}
  ],
  "monthly_plan": {
    "total": number,
    "breakdown": [{"fund": "string", "amount": number}]
  },
  "risk_score": number,
  "risk_analysis": "string",
  "expected_returns": {"conservative": number, "moderate": number, "aggressive": number},
  "key_risks": ["string"],
  "tax_notes": "string",
  "rebalancing_schedule": "string",
  "summary": "string"
}

Rules:
- allocation percentages must sum to 100
- monthly_plan.total must match the user's stated monthly investment capacity
- monthly_plan.breakdown amounts must sum to monthly_plan.total
- risk_score is 1-10 (1=very conservative, 10=very aggressive)
- expected_returns are annualised percentage returns
- Include at least 3 key_risks
- Every fund name must be a real ticker symbol (e.g. VOO, QQQ, VXUS, BND, VNQ)
"""


def _answers_hash(answers: dict[str, Any]) -> str:
    """Produce a stable hash of questionnaire answers for caching."""
    raw = json.dumps(answers, sort_keys=True)
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def _format_answers(answers: dict[str, Any]) -> str:
    """Format questionnaire answers into a readable block for agents."""
    parts: list[str] = []

    goals = answers.get("goals", {})
    if goals.get("selected"):
        parts.append(f"Investment Goals: {', '.join(goals['selected'])}")
    if goals.get("description"):
        parts.append(f"Goal Description: {goals['description']}")

    timeline = answers.get("timeline", {})
    if timeline.get("horizon"):
        parts.append(f"Time Horizon: {timeline['horizon']}")
    if timeline.get("target_date"):
        parts.append(f"Target Date: {timeline['target_date']}")

    risk = answers.get("risk", {})
    if risk.get("drawdown_reaction"):
        parts.append(f"Drawdown Reaction: {risk['drawdown_reaction']}")
    if risk.get("investment_preference"):
        parts.append(f"Investment Style: {risk['investment_preference']}")
    if risk.get("experience"):
        parts.append(f"Experience Level: {risk['experience']}")
    if risk.get("score"):
        parts.append(f"Computed Risk Score: {risk['score']}/10")

    portfolio = answers.get("portfolio", {})
    if portfolio.get("has_investments"):
        parts.append("Has Existing Investments: Yes")
        holdings = portfolio.get("holdings", [])
        if holdings:
            parts.append("Current Holdings:")
            for h in holdings:
                parts.append(f"  - {h.get('asset', 'Unknown')} ({h.get('account_type', '')}): ${h.get('value', 0):,.0f}")
    if portfolio.get("monthly_investment"):
        parts.append(f"Monthly Investment Capacity: ${portfolio['monthly_investment']:,.0f}")

    prefs = answers.get("preferences", {})
    if prefs.get("avoid"):
        parts.append(f"Sectors to Avoid: {', '.join(prefs['avoid'])}")
    if prefs.get("include"):
        parts.append(f"Asset Types to Include: {', '.join(prefs['include'])}")
    if prefs.get("tax_situation"):
        parts.append(f"Tax Situation: {prefs['tax_situation']}")

    return "\n".join(parts)


def _build_portfolio_crew(answers: dict[str, Any]) -> Crew:
    """Build the 4-agent portfolio advisory crew."""
    llm = get_llm()
    formatted = _format_answers(answers)

    profiler = Agent(
        role="Investor Profiler",
        goal="Validate and structure the user's investment profile from their questionnaire answers",
        backstory=(
            f"{SYSTEM_CONTEXT} "
            "You specialise in understanding investor profiles. You validate the "
            "questionnaire answers, check for inconsistencies, and use any existing "
            "financial data to build a complete picture."
        ),
        tools=[],
        llm=llm,
        verbose=False,
    )

    researcher = Agent(
        role="Market Research Analyst",
        goal="Analyse current market conditions and asset class performance using REAL market data",
        backstory=(
            f"{SYSTEM_CONTEXT} "
            "You are a market research specialist with access to real-time market data. "
            "You MUST use your tools to look up actual current prices, yields, and "
            "economic indicators — never guess or rely on training data for market numbers. "
            "You analyse conditions across equities, bonds, crypto, REITs using live data. "
            "Start by getting the asset class overview and economic indicators, then "
            "research specific funds relevant to the investor's needs."
        ),
        tools=[
            GetAssetClassOverviewTool(),
            GetEconomicIndicatorsTool(),
            GetStockQuoteTool(),
            GetETFInfoTool(),
            GetHistoricalPerformanceTool(),
            GetCurrentPriceTool(),
            GetNewsTool(),
            GetSentimentTool(),
        ],
        llm=llm,
        verbose=False,
    )

    strategist = Agent(
        role="Portfolio Strategist",
        goal="Construct an optimal portfolio allocation using real fund data and current market conditions",
        backstory=(
            f"{SYSTEM_CONTEXT} "
            "You are an expert portfolio strategist with access to real market data. "
            "You MUST use tools to look up actual ETF expense ratios, yields, and "
            "returns before recommending any fund. Compare similar ETFs to pick the "
            "best options. You construct diversified portfolios across asset classes "
            "(equities, bonds, crypto, REITs, cash) optimised for risk-adjusted returns. "
            "You consider tax-advantaged account placement, dollar-cost averaging, and "
            "always verify your fund selections with real data."
        ),
        tools=[
            GetETFInfoTool(),
            CompareETFsTool(),
            GetStockQuoteTool(),
            GetHistoricalPerformanceTool(),
        ],
        llm=llm,
        verbose=False,
    )

    risk_analyst = Agent(
        role="Risk Analyst",
        goal="Stress-test the recommended portfolio using real historical data and current market conditions",
        backstory=(
            f"{SYSTEM_CONTEXT} "
            "You are a quantitative risk analyst with access to real market data. "
            "You MUST use tools to look up actual historical drawdowns, volatility, "
            "and current economic conditions when stress-testing portfolios. Check "
            "the VIX, yield curve, and historical performance of the recommended funds "
            "during past downturns (2008, 2020, 2022). Never estimate risk metrics — "
            "calculate them from real data."
        ),
        tools=[
            GetHistoricalPerformanceTool(),
            GetEconomicIndicatorsTool(),
            CompareETFsTool(),
            GetStockQuoteTool(),
        ],
        llm=llm,
        verbose=False,
    )

    profile_task = Task(
        description=(
            f"The user has completed an investment questionnaire. Here are their answers:\n\n"
            f"{formatted}\n\n"
            "Validate the questionnaire answers — flag any inconsistencies (e.g. "
            "aggressive goals with conservative risk tolerance). "
            "Produce a structured investor profile summary."
        ),
        expected_output="A validated investor profile with goals, risk tolerance, constraints, and any existing financial context.",
        agent=profiler,
    )

    research_task = Task(
        description=(
            f"Based on this investor's profile:\n\n{formatted}\n\n"
            "You MUST use your tools to gather real market data. Do the following:\n"
            "1. Use get_asset_class_overview to see how all major asset classes are performing today\n"
            "2. Use get_economic_indicators to check interest rates, inflation, VIX, yield curve\n"
            "3. For any specific ETFs/stocks relevant to this investor, use get_etf_info or get_stock_quote\n"
            "4. If they want crypto exposure, use get_current_price for crypto prices\n"
            "5. Check recent news and sentiment for relevant markets\n\n"
            "Present ALL data with real numbers — never make up prices or yields."
        ),
        expected_output="A comprehensive market conditions report with real current data: asset class performance, interest rates, economic indicators, and specific fund metrics.",
        agent=researcher,
    )

    strategy_task = Task(
        description=(
            f"Using the investor profile and market research, construct an optimal portfolio.\n\n"
            f"Investor answers:\n{formatted}\n\n"
            "Requirements:\n"
            "- Diversify across asset classes appropriate for their risk level\n"
            "- Use ONLY real ticker symbols — verify each fund with get_etf_info before recommending\n"
            "- Use compare_etfs to compare similar options (e.g. VOO vs SPY vs IVV) and pick the best\n"
            "- Check actual expense ratios, yields, and returns — don't guess\n"
            "- Percentages must sum to 100%\n"
            "- Create a monthly investment plan with exact dollar amounts\n"
            "- Consider tax-advantaged vs taxable account placement\n"
            "- Provide a clear rationale referencing real performance data for each allocation\n"
        ),
        expected_output="A detailed portfolio allocation with verified funds, real expense ratios, actual returns data, percentages, monthly plan, and data-driven rationales.",
        agent=strategist,
    )

    risk_task = Task(
        description=(
            f"Stress-test the recommended portfolio for this investor.\n\n"
            f"Investor answers:\n{formatted}\n\n"
            "You MUST use tools to gather real data for the risk assessment:\n"
            "1. Use get_historical_performance with period='5y' for each recommended fund to see real drawdowns\n"
            "2. Use get_economic_indicators to check current VIX, yield curve, and rates\n"
            "3. Calculate real volatility and max drawdown from the actual data\n\n"
            "Analyse:\n"
            "- REAL historical drawdowns from the actual fund data (not estimates)\n"
            "- Expected return ranges based on actual historical performance\n"
            "- Key risks specific to this allocation, current market conditions, and timeline\n"
            "- Produce a risk score from 1-10 justified with real numbers\n\n"
            "Then synthesise ALL the team's work into the final recommendation.\n\n"
            f"{STRUCTURED_OUTPUT_PROMPT}"
        ),
        expected_output="A complete JSON recommendation object with allocation, monthly plan, data-backed risk analysis, and summary.",
        agent=risk_analyst,
    )

    return Crew(
        agents=[profiler, researcher, strategist, risk_analyst],
        tasks=[profile_task, research_task, strategy_task, risk_task],
        process=Process.sequential,
        verbose=False,
    )


def _extract_json(text: str) -> dict[str, Any] | None:
    """Try to extract a JSON object from LLM output."""
    start = text.find("{")
    if start < 0:
        return None
    depth = 0
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(text[start : i + 1])
                except json.JSONDecodeError:
                    return None
    return None


def _validate_recommendation(data: dict[str, Any], answers: dict[str, Any]) -> dict[str, Any]:
    """Validate and fix the recommendation structure."""
    defaults: dict[str, Any] = {
        "allocation": [],
        "monthly_plan": {"total": 0, "breakdown": []},
        "risk_score": 5,
        "risk_analysis": "",
        "expected_returns": {"conservative": 5.0, "moderate": 7.0, "aggressive": 10.0},
        "key_risks": [],
        "tax_notes": "",
        "rebalancing_schedule": "Quarterly",
        "summary": "",
    }

    for key, default in defaults.items():
        if key not in data:
            data[key] = default

    monthly = answers.get("portfolio", {}).get("monthly_investment", 0)
    if monthly and isinstance(data.get("monthly_plan"), dict):
        data["monthly_plan"]["total"] = monthly

    if isinstance(data.get("risk_score"), (int, float)):
        data["risk_score"] = max(1, min(10, int(data["risk_score"])))

    return data


async def generate_portfolio_recommendation(answers: dict[str, Any]) -> dict[str, Any]:
    """Run the portfolio crew and return a structured recommendation.

    Args:
        answers: Questionnaire answers dict with keys: goals, timeline, risk, portfolio, preferences.

    Returns:
        Structured recommendation JSON.
    """
    cache_key = _answers_hash(answers)
    if cache_key in _recommendation_cache:
        ts, cached = _recommendation_cache[cache_key]
        if time.time() - ts < CACHE_TTL:
            return cached

    max_retries = 3
    last_error: Exception | None = None
    for attempt in range(max_retries):
        try:
            crew = _build_portfolio_crew(answers)
            result = await asyncio.to_thread(crew.kickoff)
            break
        except Exception as e:
            last_error = e
            logger.warning("Crew attempt %d/%d failed: %s", attempt + 1, max_retries, e)
            if attempt < max_retries - 1:
                await asyncio.sleep(2 ** attempt)
    else:
        raise last_error  # type: ignore[misc]

    raw = str(result)

    recommendation = _extract_json(raw)
    if not recommendation:
        logger.warning("Failed to parse structured JSON from crew output, building fallback")
        recommendation = {
            "allocation": [],
            "monthly_plan": {"total": answers.get("portfolio", {}).get("monthly_investment", 0), "breakdown": []},
            "risk_score": answers.get("risk", {}).get("score", 5),
            "risk_analysis": raw[:2000],
            "expected_returns": {"conservative": 5.0, "moderate": 7.5, "aggressive": 10.0},
            "key_risks": ["Market volatility", "Inflation risk", "Interest rate changes"],
            "tax_notes": "",
            "rebalancing_schedule": "Quarterly",
            "summary": raw[:1000],
        }

    recommendation = _validate_recommendation(recommendation, answers)
    _recommendation_cache[cache_key] = (time.time(), recommendation)
    return recommendation


async def stream_portfolio_chat(
    messages: list[dict[str, str]],
    recommendation: dict[str, Any] | None = None,
) -> AsyncGenerator[str, None]:
    """Stream follow-up portfolio chat responses as SSE events.

    Args:
        messages: Conversation messages.
        recommendation: The portfolio recommendation for context.
    """
    user_message = ""
    for msg in reversed(messages):
        if msg.get("role") == "user":
            user_message = msg.get("content", "")
            break

    if not user_message:
        yield f"data: {json.dumps({'type': 'error', 'content': 'No user message provided'})}\n\n"
        yield "data: [DONE]\n\n"
        return

    context_parts = []
    for msg in messages[:-1]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if content:
            context_parts.append(f"{role}: {content[:500]}")
    conversation_context = "\n".join(context_parts[-6:])

    rec_context = ""
    if recommendation:
        rec_summary = recommendation.get("summary", "")
        alloc = recommendation.get("allocation", [])
        alloc_str = ", ".join(
            f"{a.get('asset_class', '')}: {a.get('percentage', 0)}% ({', '.join(a.get('funds', []))})"
            for a in alloc
        )
        rec_context = (
            f"\n\nThe user's current portfolio recommendation:\n"
            f"Summary: {rec_summary}\n"
            f"Allocation: {alloc_str}\n"
            f"Risk Score: {recommendation.get('risk_score', 'N/A')}/10\n"
        )

    yield f"data: {json.dumps({'type': 'thinking', 'content': 'Reviewing your portfolio recommendation...'})}\n\n"

    try:
        llm = get_llm()

        advisor = Agent(
            role="Portfolio Advisor",
            goal="Answer follow-up questions about the portfolio recommendation",
            backstory=(
                f"{SYSTEM_CONTEXT} "
                "You are the lead portfolio advisor answering follow-up questions. "
                "Reference the specific recommendation that was given. Be conversational "
                "but precise with numbers and fund names."
            ),
            tools=[
                GetStockQuoteTool(),
                GetETFInfoTool(),
                GetHistoricalPerformanceTool(),
                CompareETFsTool(),
                GetEconomicIndicatorsTool(),
                GetCurrentPriceTool(),
                GetNewsTool(),
            ],
            llm=llm,
            verbose=False,
        )

        task = Task(
            description=(
                f"The user asks: {user_message}\n"
                f"{rec_context}\n"
                f"Previous conversation:\n{conversation_context}\n\n"
                "Answer their question about the portfolio recommendation. "
                "Be specific, reference the actual funds and allocations."
            ),
            expected_output="A helpful, specific response about the portfolio recommendation.",
            agent=advisor,
        )

        crew = Crew(
            agents=[advisor],
            tasks=[task],
            process=Process.sequential,
            verbose=False,
        )

        yield f"data: {json.dumps({'type': 'thinking', 'content': 'Analysing your question...'})}\n\n"

        result = await asyncio.to_thread(crew.kickoff)
        response_text = str(result)

        yield f"data: {json.dumps({'type': 'text', 'content': response_text})}\n\n"

    except Exception as e:
        logger.exception("Portfolio chat crew execution failed")
        error_msg = f"I encountered an error processing your request: {str(e)}"
        yield f"data: {json.dumps({'type': 'error', 'content': error_msg})}\n\n"

    yield "data: [DONE]\n\n"
