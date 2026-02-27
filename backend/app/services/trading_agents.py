"""CrewAI trading agents — objective-driven trade proposal generation."""

import json
import logging
from typing import Any, Type

from crewai import Agent, Crew, Process, Task
from crewai.tools import BaseTool
from pydantic import BaseModel, Field, field_validator

from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.historical.news import NewsClient
from alpaca.data.requests import NewsRequest, StockLatestQuoteRequest

from app.config import get_settings
from app.models.trading_objectives import (
    TradingObjective,
    TradeProposal,
    save_proposals_batch,
)
from app.services.alpaca_client import get_account, get_positions
from app.services.llm import get_llm

logger = logging.getLogger(__name__)

_data_client: StockHistoricalDataClient | None = None
_news_client: NewsClient | None = None


def _get_data_client() -> StockHistoricalDataClient:
    global _data_client
    if _data_client is None:
        s = get_settings()
        _data_client = StockHistoricalDataClient(
            api_key=s.alpaca_api_key, secret_key=s.alpaca_secret_key
        )
    return _data_client


def _get_news_client() -> NewsClient:
    global _news_client
    if _news_client is None:
        s = get_settings()
        _news_client = NewsClient(
            api_key=s.alpaca_api_key, secret_key=s.alpaca_secret_key
        )
    return _news_client


class GetAccountSummaryInput(BaseModel):
    placeholder: str = Field("", description="Not used — leave empty.")


class GetAccountSummaryTool(BaseTool):
    name: str = "get_account_summary"
    description: str = (
        "Get the current paper trading account summary including equity, "
        "buying power, cash, and portfolio value."
    )
    args_schema: Type[BaseModel] = GetAccountSummaryInput

    def _run(self, **kwargs: str) -> str:
        try:
            return json.dumps(get_account(), indent=2)
        except Exception as e:
            return f"Error fetching account: {e}"


class GetCurrentPositionsInput(BaseModel):
    placeholder: str = Field("", description="Not used — leave empty.")


class GetCurrentPositionsTool(BaseTool):
    name: str = "get_current_positions"
    description: str = (
        "Get all current open positions in the portfolio with symbols, quantities, "
        "market values, cost basis, and unrealized P&L."
    )
    args_schema: Type[BaseModel] = GetCurrentPositionsInput

    def _run(self, **kwargs: str) -> str:
        try:
            positions = get_positions()
            if not positions:
                return "No open positions."
            return json.dumps(positions, indent=2)
        except Exception as e:
            return f"Error fetching positions: {e}"


class GetStockQuoteInput(BaseModel):
    symbols: str = Field(
        ...,
        description="Comma-separated stock symbols, e.g. 'AAPL,MSFT,VOO'",
    )


class GetStockQuoteTool(BaseTool):
    name: str = "get_stock_quote"
    description: str = (
        "Get the latest bid/ask quotes for one or more stocks or ETFs. "
        "Pass comma-separated symbols like 'AAPL,VOO,SPY'."
    )
    args_schema: Type[BaseModel] = GetStockQuoteInput

    def _run(self, symbols: str) -> str:
        try:
            sym_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
            client = _get_data_client()
            req = StockLatestQuoteRequest(symbol_or_symbols=sym_list)
            quotes = client.get_stock_latest_quote(req)
            result = {}
            for sym, q in quotes.items():
                result[sym] = {
                    "bid_price": float(q.bid_price) if q.bid_price else None,
                    "ask_price": float(q.ask_price) if q.ask_price else None,
                    "bid_size": q.bid_size,
                    "ask_size": q.ask_size,
                }
            return json.dumps(result, indent=2)
        except Exception as e:
            return f"Error fetching quotes: {e}"


class GetMarketNewsInput(BaseModel):
    symbols: str = Field(
        ...,
        description="Comma-separated stock symbols for news, e.g. 'AAPL,MSFT'",
    )
    limit: int = Field(5, description="Number of articles (1-10). Default 5.")

    @field_validator("limit", mode="before")
    @classmethod
    def coerce_limit(cls, v: object) -> int:
        try:
            return int(v)
        except (TypeError, ValueError):
            return 5


class GetMarketNewsTool(BaseTool):
    name: str = "get_market_news"
    description: str = (
        "Get recent market news for specific stocks or ETFs. "
        "Returns headlines, sources, and summaries."
    )
    args_schema: Type[BaseModel] = GetMarketNewsInput

    def _run(self, symbols: str, limit: int = 5) -> str:
        try:
            client = _get_news_client()
            sym_str = ",".join(
                s.strip().upper() for s in symbols.split(",") if s.strip()
            )
            req = NewsRequest(symbols=sym_str, limit=min(limit, 10))
            news_set = client.get_news(req)
            data = news_set.dict()
            articles = data.get("news", [])
            if not articles:
                return "No recent news found."
            lines = []
            for i, a in enumerate(articles, 1):
                headline = a.get("headline", "")
                source = a.get("source", "")
                summary = (a.get("summary", "") or "")[:200]
                lines.append(f"{i}. {headline} ({source})\n   {summary}")
            return "\n\n".join(lines)
        except Exception as e:
            return f"Error fetching news: {e}"


def generate_trade_proposals(objective: TradingObjective) -> dict[str, Any]:
    """Run the trading crew and return structured proposals."""
    llm = get_llm()

    account_tool = GetAccountSummaryTool()
    positions_tool = GetCurrentPositionsTool()
    quote_tool = GetStockQuoteTool()
    news_tool = GetMarketNewsTool()

    universe_str = ", ".join(objective.asset_universe) if objective.asset_universe else "any US stocks/ETFs"
    has_universe = bool(objective.asset_universe)

    objective_context = (
        f"USER'S INVESTMENT OBJECTIVE:\n"
        f"  Goal: {objective.goal}\n"
        f"  Target return: {objective.target_return_pct}% in {objective.timeframe_days} days\n"
        f"  Risk tolerance: {objective.risk_tolerance.value}\n"
        f"  Allowed asset universe: {universe_str}\n"
        f"  Max position size: {objective.max_position_pct}% of portfolio\n"
        f"  Max daily loss: {objective.max_daily_loss_pct}%"
    )

    market_analyst = Agent(
        role="Senior Market Analyst",
        goal=(
            f"Analyze the portfolio and market conditions specifically for this goal: "
            f"{objective.goal}"
        ),
        backstory=(
            f"You are a senior market analyst. The user's goal is: \"{objective.goal}\". "
            f"You must focus your analysis on the assets in their universe ({universe_str}) "
            f"and market conditions relevant to their specific objective. Do NOT analyze "
            f"unrelated sectors or generic market conditions."
        ),
        tools=[account_tool, positions_tool, quote_tool, news_tool],
        llm=llm,
        verbose=False,
    )

    strategist = Agent(
        role="Portfolio Strategist",
        goal=(
            f"Generate trade proposals that directly advance this goal: {objective.goal}"
        ),
        backstory=(
            f"You are a portfolio strategist. The user wants to: \"{objective.goal}\". "
            f"You MUST propose trades from their asset universe ({universe_str}). "
            f"Every proposal must directly serve this specific goal. "
            f"Do NOT recommend generic stocks outside the universe."
        ),
        tools=[quote_tool],
        llm=llm,
        verbose=False,
    )

    risk_manager = Agent(
        role="Risk Manager",
        goal="Validate trade proposals against risk rules and goal alignment",
        backstory=(
            f"You are a risk manager. The user's goal is: \"{objective.goal}\" with "
            f"{objective.risk_tolerance.value} risk tolerance. You validate proposals "
            f"against position limits, buying power, and diversification rules. "
            f"Also reject any proposal for a stock outside the allowed universe "
            f"({universe_str}) unless the universe is empty."
        ),
        tools=[account_tool, positions_tool],
        llm=llm,
        verbose=False,
    )

    universe_instruction = (
        f"CRITICAL: You MUST ONLY propose stocks from this universe: {universe_str}. "
        f"Do NOT propose any stock outside this list."
        if has_universe
        else "The user has not restricted their universe — you may propose any US stocks/ETFs."
    )

    analysis_task = Task(
        description=(
            f"{objective_context}\n\n"
            f"Analyze the portfolio in the context of the user's goal: \"{objective.goal}\".\n\n"
            f"Steps:\n"
            f"1. Fetch account summary and current positions\n"
            f"2. Get quotes for the assets in the universe: {universe_str}\n"
            f"3. Check recent news for these specific assets\n"
            f"4. Assess: How well does the current portfolio align with \"{objective.goal}\"? "
            f"What gaps exist? Which assets from the universe should be added or adjusted?\n\n"
            f"Focus your entire analysis on the user's stated goal. Do NOT provide generic "
            f"market commentary unrelated to their objective."
        ),
        expected_output=(
            f"A goal-oriented analysis covering current portfolio state, quotes for "
            f"universe assets ({universe_str}), relevant news, and specific opportunities "
            f"to advance the goal: \"{objective.goal}\"."
        ),
        agent=market_analyst,
    )

    strategy_task = Task(
        description=(
            f"{objective_context}\n\n"
            f"Generate 2-5 trade proposals that directly advance the goal: \"{objective.goal}\".\n\n"
            f"{universe_instruction}\n\n"
            f"Each proposal's rationale MUST explain how it specifically serves the goal "
            f"\"{objective.goal}\" — not just generic market reasoning.\n\n"
            f"Constraints:\n"
            f"- Max position size: {objective.max_position_pct}% of portfolio\n"
            f"- Risk tolerance: {objective.risk_tolerance.value}\n"
            f"- Quantities must be whole numbers\n\n"
            f"Output ONLY a JSON object with this exact structure:\n"
            '{"proposals": [{"action": "buy"|"sell", "symbol": "XXX", "qty": N, '
            '"rationale": "How this trade serves the goal...", "expected_impact": "...", '
            '"risk_level": "low"|"medium"|"high"}], '
            '"universe_suggestions": ["SYM1", "SYM2"]}\n\n'
            f"universe_suggestions: If the goal mentions a theme/sector not well-covered "
            f"by the current universe, suggest additional symbols the user should add. "
            f"Set to [] if the universe is adequate.\n\n"
            f"Output ONLY the JSON, no other text."
        ),
        expected_output=(
            f"A JSON object with trade proposals from the universe ({universe_str}) "
            f"that advance the goal \"{objective.goal}\", plus optional universe_suggestions."
        ),
        agent=strategist,
    )

    risk_task = Task(
        description=(
            f"{objective_context}\n\n"
            f"Review each trade proposal against these rules:\n"
            f"1. Position won't exceed {objective.max_position_pct}% of portfolio\n"
            f"2. Sufficient buying power exists for buys\n"
            f"3. Daily loss limit of {objective.max_daily_loss_pct}% not breached\n"
            f"4. Adequate diversification maintained\n"
            + (
                f"5. Stock MUST be in the allowed universe: {universe_str}. "
                f"REJECT any proposal for a stock not in this list.\n"
                if has_universe
                else ""
            )
            + "\nFor each proposal, output APPROVED or REJECTED with reasoning.\n"
            "IMPORTANT: Include ALL fields from the original proposal (symbol, action, qty, "
            "rationale, expected_impact, risk_level) plus your verdict and reasoning.\n\n"
            "Output ONLY a JSON object:\n"
            '{"reviews": [{"symbol": "XXX", "action": "buy"|"sell", "qty": N, '
            '"rationale": "original rationale", "expected_impact": "...", '
            '"risk_level": "low"|"medium"|"high", '
            '"verdict": "approved"|"rejected", "reasoning": "..."}], '
            '"universe_suggestions": ["SYM1"]}'
        ),
        expected_output="A JSON object with approval/rejection for each proposal including all original fields and universe_suggestions.",
        agent=risk_manager,
    )

    crew = Crew(
        agents=[market_analyst, strategist, risk_manager],
        tasks=[analysis_task, strategy_task, risk_task],
        process=Process.sequential,
        verbose=False,
    )

    result = crew.kickoff()
    raw_output = str(result)

    return _parse_crew_output(raw_output, objective)


def _parse_crew_output(
    raw_output: str, objective: TradingObjective
) -> dict[str, Any]:
    """Parse the crew's final output into structured proposals."""
    proposals: list[TradeProposal] = []
    universe_suggestions: list[str] = []

    try:
        start = raw_output.find("{")
        end = raw_output.rfind("}") + 1
        if start >= 0 and end > start:
            parsed = json.loads(raw_output[start:end])
            reviews = parsed.get("reviews", [])
            raw_suggestions = parsed.get("universe_suggestions", [])
            if isinstance(raw_suggestions, list):
                universe_suggestions = [str(s).upper() for s in raw_suggestions if s]

            for review in reviews:
                symbol = review.get("symbol", "")
                action = review.get("action", "")
                verdict = review.get("verdict", "rejected")
                reasoning = review.get("reasoning", "")

                if not symbol or not action:
                    continue

                status = "pending" if verdict == "approved" else "rejected"
                qty_raw = review.get("qty", 1)
                try:
                    qty = max(1, int(qty_raw))
                except (TypeError, ValueError):
                    qty = 1

                proposals.append(
                    TradeProposal(
                        symbol=symbol.upper(),
                        action=action.lower(),
                        qty=qty,
                        rationale=review.get("rationale", reasoning),
                        expected_impact=review.get("expected_impact", ""),
                        risk_level=review.get("risk_level", "medium"),
                        risk_review=reasoning,
                        status=status,
                    )
                )
    except (json.JSONDecodeError, KeyError, TypeError) as e:
        logger.warning("Failed to parse crew output: %s", e)

    if not proposals:
        proposals = _fallback_parse(raw_output)

    saved = save_proposals_batch(proposals) if proposals else []

    return {
        "objective": objective.goal,
        "proposals": saved,
        "total": len(saved),
        "approved": sum(1 for p in saved if p.get("status") == "pending"),
        "rejected": sum(1 for p in saved if p.get("status") == "rejected"),
        "universe_suggestions": universe_suggestions,
        "raw_output": raw_output[:2000],
    }


def _fallback_parse(raw_output: str) -> list[TradeProposal]:
    """Try to extract proposals from less structured output."""
    proposals: list[TradeProposal] = []
    try:
        json_blocks = []
        i = 0
        while i < len(raw_output):
            start = raw_output.find("{", i)
            if start < 0:
                break
            depth = 0
            j = start
            while j < len(raw_output):
                if raw_output[j] == "{":
                    depth += 1
                elif raw_output[j] == "}":
                    depth -= 1
                    if depth == 0:
                        json_blocks.append(raw_output[start : j + 1])
                        break
                j += 1
            i = j + 1

        for block in json_blocks:
            try:
                parsed = json.loads(block)
                items = parsed.get("proposals", parsed.get("reviews", []))
                if isinstance(items, list):
                    for item in items:
                        if isinstance(item, dict) and item.get("symbol"):
                            proposals.append(
                                TradeProposal(
                                    symbol=item["symbol"].upper(),
                                    action=item.get("action", "buy"),
                                    qty=int(item.get("qty", 1)),
                                    rationale=item.get("rationale", item.get("reasoning", "")),
                                    expected_impact=item.get("expected_impact", ""),
                                    risk_level=item.get("risk_level", "medium"),
                                    risk_review=item.get("reasoning", item.get("verdict", "")),
                                    status="pending" if item.get("verdict", "approved") == "approved" else "rejected",
                                )
                            )
                    if proposals:
                        break
            except json.JSONDecodeError:
                continue
    except Exception as e:
        logger.warning("Fallback parse also failed: %s", e)

    return proposals
