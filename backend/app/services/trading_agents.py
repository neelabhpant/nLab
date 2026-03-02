"""CrewAI trading agents — objective-driven trade proposal generation."""

import json
import logging
import queue
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Generator, Type

import pandas as pd
from crewai import Agent, Crew, Process, Task
from crewai.tools import BaseTool
from pydantic import BaseModel, Field, field_validator

from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.historical.news import NewsClient
from alpaca.data.requests import (
    NewsRequest,
    StockBarsRequest,
    StockLatestQuoteRequest,
)
from alpaca.data.enums import DataFeed
from alpaca.data.timeframe import TimeFrame

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


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------


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


class GetStockHistoryInput(BaseModel):
    symbol: str = Field(
        ...,
        description="A single stock symbol, e.g. 'AAPL'",
    )
    days: int = Field(90, description="Number of days of history (1-365). Default 90.")

    @field_validator("days", mode="before")
    @classmethod
    def coerce_days(cls, v: object) -> int:
        try:
            return max(1, min(int(v), 365))
        except (TypeError, ValueError):
            return 90


class GetStockHistoryTool(BaseTool):
    name: str = "get_stock_history"
    description: str = (
        "Get daily OHLCV price history for a single stock. Returns date, open, "
        "high, low, close, volume for up to 365 days. Use for trend analysis."
    )
    args_schema: Type[BaseModel] = GetStockHistoryInput

    def _run(self, symbol: str, days: int = 90) -> str:
        try:
            client = _get_data_client()
            end = datetime.now(timezone.utc)
            start = end - timedelta(days=days)
            req = StockBarsRequest(
                symbol_or_symbols=symbol.strip().upper(),
                timeframe=TimeFrame.Day,
                start=start,
                end=end,
                feed=DataFeed.IEX,
            )
            bars = client.get_stock_bars(req)
            bar_list = bars[symbol.strip().upper()]
            result = []
            for b in bar_list[-60:]:
                result.append({
                    "date": b.timestamp.strftime("%Y-%m-%d"),
                    "open": round(float(b.open), 2),
                    "high": round(float(b.high), 2),
                    "low": round(float(b.low), 2),
                    "close": round(float(b.close), 2),
                    "volume": int(b.volume),
                })
            return json.dumps(result, indent=2)
        except Exception as e:
            return f"Error fetching history for {symbol}: {e}"


class GetTechnicalIndicatorsInput(BaseModel):
    symbol: str = Field(
        ...,
        description="A single stock symbol, e.g. 'AAPL'",
    )


class GetTechnicalIndicatorsTool(BaseTool):
    name: str = "get_technical_indicators"
    description: str = (
        "Compute key technical indicators for a stock: SMA-20, SMA-50, SMA-200, "
        "RSI-14, MACD (line, signal, histogram), Bollinger Bands (upper, middle, lower), "
        "52-week high/low, and average volume. Essential for timing entries and exits."
    )
    args_schema: Type[BaseModel] = GetTechnicalIndicatorsInput

    def _run(self, symbol: str) -> str:
        try:
            import ta as ta_lib

            client = _get_data_client()
            end = datetime.now(timezone.utc)
            start = end - timedelta(days=365)
            req = StockBarsRequest(
                symbol_or_symbols=symbol.strip().upper(),
                timeframe=TimeFrame.Day,
                start=start,
                end=end,
                feed=DataFeed.IEX,
            )
            bars = client.get_stock_bars(req)
            bar_list = bars[symbol.strip().upper()]

            df = pd.DataFrame([{
                "date": b.timestamp,
                "open": float(b.open),
                "high": float(b.high),
                "low": float(b.low),
                "close": float(b.close),
                "volume": int(b.volume),
            } for b in bar_list])

            if len(df) < 20:
                return f"Insufficient data for {symbol} ({len(df)} bars)."

            close = df["close"]
            high = df["high"]
            low = df["low"]
            latest = close.iloc[-1]

            sma_20 = close.rolling(20).mean().iloc[-1]
            sma_50 = close.rolling(50).mean().iloc[-1] if len(df) >= 50 else None
            sma_200 = close.rolling(200).mean().iloc[-1] if len(df) >= 200 else None

            rsi = ta_lib.momentum.RSIIndicator(close, window=14).rsi().iloc[-1]

            macd_obj = ta_lib.trend.MACD(close)
            macd_line = macd_obj.macd().iloc[-1]
            macd_signal = macd_obj.macd_signal().iloc[-1]
            macd_hist = macd_obj.macd_diff().iloc[-1]

            bb = ta_lib.volatility.BollingerBands(close, window=20, window_dev=2)
            bb_upper = bb.bollinger_hband().iloc[-1]
            bb_lower = bb.bollinger_lband().iloc[-1]
            bb_middle = bb.bollinger_mavg().iloc[-1]

            high_52w = high.tail(252).max() if len(df) >= 252 else high.max()
            low_52w = low.tail(252).min() if len(df) >= 252 else low.min()

            avg_vol_20 = df["volume"].tail(20).mean()

            pct_from_high = round(((latest - high_52w) / high_52w) * 100, 1)

            trend = "BULLISH" if sma_50 and latest > sma_50 else "BEARISH" if sma_50 and latest < sma_50 else "NEUTRAL"
            rsi_signal = "OVERBOUGHT" if rsi > 70 else "OVERSOLD" if rsi < 30 else "NEUTRAL"
            macd_signal_str = "BULLISH" if macd_hist > 0 else "BEARISH"

            result = {
                "symbol": symbol.strip().upper(),
                "current_price": round(latest, 2),
                "sma_20": round(sma_20, 2),
                "sma_50": round(sma_50, 2) if sma_50 else None,
                "sma_200": round(sma_200, 2) if sma_200 else None,
                "rsi_14": round(rsi, 1),
                "rsi_signal": rsi_signal,
                "macd_line": round(macd_line, 3),
                "macd_signal": round(macd_signal, 3),
                "macd_histogram": round(macd_hist, 3),
                "macd_trend": macd_signal_str,
                "bollinger_upper": round(bb_upper, 2),
                "bollinger_middle": round(bb_middle, 2),
                "bollinger_lower": round(bb_lower, 2),
                "high_52w": round(float(high_52w), 2),
                "low_52w": round(float(low_52w), 2),
                "pct_from_52w_high": pct_from_high,
                "avg_volume_20d": int(avg_vol_20),
                "trend_signal": trend,
                "summary": (
                    f"{symbol.upper()}: Price ${latest:.2f} | "
                    f"Trend: {trend} | RSI: {rsi:.0f} ({rsi_signal}) | "
                    f"MACD: {macd_signal_str} | "
                    f"{pct_from_high:+.1f}% from 52w high"
                ),
            }
            return json.dumps(result, indent=2)
        except Exception as e:
            return f"Error computing indicators for {symbol}: {e}"


class GetMarketOverviewInput(BaseModel):
    placeholder: str = Field("", description="Not used — leave empty.")


class GetMarketOverviewTool(BaseTool):
    name: str = "get_market_overview"
    description: str = (
        "Get a broad market overview: S&P 500 (SPY), Nasdaq (QQQ), Dow (DIA), "
        "VIX (fear index via VIXY), and major sector ETFs performance. "
        "Essential for understanding the market regime before proposing trades."
    )
    args_schema: Type[BaseModel] = GetMarketOverviewInput

    def _run(self, **kwargs: str) -> str:
        try:
            client = _get_data_client()
            symbols = [
                "SPY", "QQQ", "DIA", "VIXY",
                "XLK", "XLF", "XLE", "XLV", "XLI", "XLU", "XLRE",
            ]
            end = datetime.now(timezone.utc)
            start_5d = end - timedelta(days=7)
            start_30d = end - timedelta(days=35)

            req_5d = StockBarsRequest(
                symbol_or_symbols=symbols,
                timeframe=TimeFrame.Day,
                start=start_5d,
                end=end,
                feed=DataFeed.IEX,
            )
            req_30d = StockBarsRequest(
                symbol_or_symbols=symbols,
                timeframe=TimeFrame.Day,
                start=start_30d,
                end=end,
                feed=DataFeed.IEX,
            )
            bars_5d = client.get_stock_bars(req_5d)
            bars_30d = client.get_stock_bars(req_30d)

            sector_names = {
                "SPY": "S&P 500", "QQQ": "Nasdaq 100", "DIA": "Dow 30",
                "VIXY": "Volatility (VIX proxy)",
                "XLK": "Technology", "XLF": "Financials", "XLE": "Energy",
                "XLV": "Healthcare", "XLI": "Industrials", "XLU": "Utilities",
                "XLRE": "Real Estate",
            }

            result = {}
            for sym in symbols:
                entry: dict[str, Any] = {"name": sector_names.get(sym, sym)}
                bl_5d = bars_5d.get(sym, [])
                bl_30d = bars_30d.get(sym, [])
                if bl_5d and len(bl_5d) >= 2:
                    current = float(bl_5d[-1].close)
                    prev = float(bl_5d[0].open)
                    entry["current_price"] = round(current, 2)
                    entry["change_5d_pct"] = round(((current - prev) / prev) * 100, 2)
                if bl_30d and len(bl_30d) >= 2:
                    current = float(bl_30d[-1].close)
                    prev_30 = float(bl_30d[0].open)
                    entry["change_30d_pct"] = round(((current - prev_30) / prev_30) * 100, 2)
                result[sym] = entry

            vixy_5d = result.get("VIXY", {}).get("change_5d_pct", 0)
            if vixy_5d > 10:
                regime = "HIGH FEAR — risk-off environment, favor defensive sectors"
            elif vixy_5d > 3:
                regime = "ELEVATED CAUTION — mild risk-off, consider hedging"
            elif vixy_5d < -5:
                regime = "COMPLACENT — risk-on, momentum favored"
            else:
                regime = "NEUTRAL — normal conditions"

            result["market_regime"] = regime
            return json.dumps(result, indent=2)
        except Exception as e:
            return f"Error fetching market overview: {e}"


# ---------------------------------------------------------------------------
# Crew orchestration
# ---------------------------------------------------------------------------

AGENT_ROLES = [
    "Senior Market Analyst",
    "Technical Analyst",
    "Portfolio Strategist",
    "Risk Manager",
]


def _build_crew_components(
    objective: TradingObjective,
    event_queue: queue.Queue | None = None,
) -> tuple[Crew, str, bool]:
    """Build agents, tasks, and crew. Returns (crew, universe_str, has_universe)."""
    llm = get_llm()

    account_tool = GetAccountSummaryTool()
    positions_tool = GetCurrentPositionsTool()
    quote_tool = GetStockQuoteTool()
    news_tool = GetMarketNewsTool()
    history_tool = GetStockHistoryTool()
    ta_tool = GetTechnicalIndicatorsTool()
    overview_tool = GetMarketOverviewTool()

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
            f"Analyze the portfolio, market conditions, and news specifically for: "
            f"{objective.goal}"
        ),
        backstory=(
            f"You are a senior market analyst at a top investment bank. "
            f"The user's goal is: \"{objective.goal}\". "
            f"You focus on the assets in their universe ({universe_str}) "
            f"and broader market conditions. You gather account data, positions, "
            f"current quotes, market overview, and relevant news. "
            f"Do NOT analyze unrelated sectors."
        ),
        tools=[account_tool, positions_tool, quote_tool, news_tool, overview_tool],
        llm=llm,
        verbose=False,
    )

    technical_analyst = Agent(
        role="Technical Analyst",
        goal=(
            f"Provide technical analysis for each asset in the universe "
            f"to identify optimal entry/exit levels and momentum signals"
        ),
        backstory=(
            f"You are a quantitative technical analyst. You compute and interpret "
            f"technical indicators (SMA, RSI, MACD, Bollinger Bands) for each "
            f"asset in the universe ({universe_str}). You identify whether stocks "
            f"are overbought/oversold, trending up/down, and suggest price levels "
            f"for entries and exits. You provide data-driven signals, not opinions."
        ),
        tools=[ta_tool, history_tool, quote_tool],
        llm=llm,
        verbose=False,
    )

    strategist = Agent(
        role="Portfolio Strategist",
        goal=(
            f"Generate trade proposals with precise entry, target, and stop-loss "
            f"levels that advance: {objective.goal}"
        ),
        backstory=(
            f"You are a portfolio strategist at a top wealth management firm. "
            f"The user wants to: \"{objective.goal}\". "
            f"You synthesize the market analysis and technical analysis to create "
            f"actionable trade proposals. Each proposal MUST include a specific "
            f"entry price, price target, stop-loss, confidence level, and time horizon. "
            f"You MUST propose trades from the universe ({universe_str}). "
            f"Every proposal must directly serve the stated goal."
        ),
        tools=[quote_tool],
        llm=llm,
        verbose=False,
    )

    risk_manager = Agent(
        role="Risk Manager",
        goal="Validate proposals against risk rules, position limits, and portfolio balance",
        backstory=(
            f"You are a chief risk officer. The user's goal is: \"{objective.goal}\" with "
            f"{objective.risk_tolerance.value} risk tolerance. You validate proposals "
            f"against position limits, buying power, diversification, and sector "
            f"concentration. You also check that confidence scores are reasonable "
            f"given the technical signals. Reject any proposal for a stock outside "
            f"the allowed universe ({universe_str}) unless the universe is empty."
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
            f"Analyze the portfolio and market in the context of: \"{objective.goal}\".\n\n"
            f"Steps:\n"
            f"1. Fetch account summary and current positions\n"
            f"2. Get the broad market overview (SPY, QQQ, VIX, sector ETFs)\n"
            f"3. Get latest quotes for the universe: {universe_str}\n"
            f"4. Check recent news (up to 10 articles) for these assets\n"
            f"5. Assess: What is the current market regime? How does the portfolio "
            f"align with \"{objective.goal}\"? What gaps or risks exist?\n\n"
            f"Provide a structured analysis that the next agents can act on."
        ),
        expected_output=(
            f"A structured market analysis covering: market regime, account state, "
            f"portfolio alignment with goal, per-asset quotes, key news catalysts."
        ),
        agent=market_analyst,
    )

    technical_task = Task(
        description=(
            f"{objective_context}\n\n"
            f"Run technical analysis on each asset in the universe: {universe_str}.\n\n"
            f"For each symbol:\n"
            f"1. Get technical indicators (SMA, RSI, MACD, Bollinger Bands)\n"
            f"2. Get 90-day price history to understand the trend\n"
            f"3. Identify: Is the stock trending up or down? Overbought or oversold? "
            f"Where are key support/resistance levels?\n\n"
            f"For each stock, provide:\n"
            f"- Trend direction (BULLISH / BEARISH / NEUTRAL)\n"
            f"- RSI signal (OVERBOUGHT / OVERSOLD / NEUTRAL)\n"
            f"- MACD momentum (BULLISH / BEARISH)\n"
            f"- Suggested entry zone (price range)\n"
            f"- Support level (potential stop-loss)\n"
            f"- Resistance level (potential price target)\n"
            f"- Overall technical rating (STRONG_BUY / BUY / HOLD / SELL / STRONG_SELL)\n\n"
            f"Be precise with numbers. No vague statements."
        ),
        expected_output=(
            f"Per-symbol technical analysis with trend, RSI, MACD signals, "
            f"entry zones, support/resistance levels, and ratings."
        ),
        agent=technical_analyst,
    )

    strategy_task = Task(
        description=(
            f"{objective_context}\n\n"
            f"Using the market analysis and technical analysis, generate 2-5 trade "
            f"proposals that advance: \"{objective.goal}\".\n\n"
            f"{universe_instruction}\n\n"
            f"For EACH proposal, you MUST include ALL of these fields:\n"
            f"- action: \"buy\" or \"sell\"\n"
            f"- symbol: stock ticker\n"
            f"- qty: whole number of shares\n"
            f"- entry_price: specific price to enter (use current price or limit)\n"
            f"- price_target: specific target price for profit taking\n"
            f"- stop_loss: specific price for loss protection\n"
            f"- confidence: 0-100 score based on signal alignment\n"
            f"  (80+ = strong technical + fundamental + news alignment,\n"
            f"   60-79 = moderate alignment, <60 = speculative)\n"
            f"- time_horizon: e.g. \"2-4 weeks\", \"1-3 months\"\n"
            f"- catalyst: specific upcoming event or driver\n"
            f"- rationale: how this trade serves the goal (2-3 sentences)\n"
            f"- expected_impact: portfolio impact description\n"
            f"- risk_level: \"low\", \"medium\", or \"high\"\n"
            f"- technical_summary: 1-line technical signal summary\n\n"
            f"Constraints:\n"
            f"- Max position size: {objective.max_position_pct}% of portfolio\n"
            f"- Risk tolerance: {objective.risk_tolerance.value}\n"
            f"- Quantities must be whole numbers\n"
            f"- Risk/reward ratio should be at least 1.5:1\n\n"
            f"Output ONLY a JSON object:\n"
            '{{"proposals": [{{"action": "buy"|"sell", "symbol": "XXX", "qty": N, '
            '"entry_price": X.XX, "price_target": X.XX, "stop_loss": X.XX, '
            '"confidence": N, "time_horizon": "...", "catalyst": "...", '
            '"rationale": "...", "expected_impact": "...", '
            '"risk_level": "low"|"medium"|"high", "technical_summary": "..."}}], '
            '"universe_suggestions": ["SYM1"]}}\n\n'
            f"Output ONLY the JSON, no other text."
        ),
        expected_output=(
            f"A JSON object with detailed trade proposals including entry/target/stop "
            f"prices, confidence scores, and technical summaries."
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
            f"5. Risk/reward ratio is at least 1.5:1 (check entry vs target vs stop)\n"
            f"6. Confidence score is justified by the technical signals\n"
            + (
                f"7. Stock MUST be in the allowed universe: {universe_str}. "
                f"REJECT any proposal for a stock not in this list.\n"
                if has_universe
                else ""
            )
            + "\nFor each proposal, output APPROVED or REJECTED with reasoning.\n"
            "IMPORTANT: Include ALL fields from the original proposal plus your verdict "
            "and reasoning. Adjust confidence if you think it's too high/low.\n\n"
            "Output ONLY a JSON object:\n"
            '{"reviews": [{"symbol": "XXX", "action": "buy"|"sell", "qty": N, '
            '"entry_price": X.XX, "price_target": X.XX, "stop_loss": X.XX, '
            '"confidence": N, "time_horizon": "...", "catalyst": "...", '
            '"rationale": "...", "expected_impact": "...", '
            '"risk_level": "low"|"medium"|"high", "technical_summary": "...", '
            '"verdict": "approved"|"rejected", "reasoning": "..."}], '
            '"universe_suggestions": ["SYM1"]}'
        ),
        expected_output=(
            "A JSON object with approval/rejection for each proposal including all "
            "fields, adjusted confidence, and universe_suggestions."
        ),
        agent=risk_manager,
    )

    agents = [market_analyst, technical_analyst, strategist, risk_manager]
    tasks = [analysis_task, technical_task, strategy_task, risk_task]

    step_cb = None
    task_cb = None

    if event_queue is not None:
        current_agent_idx = [0]

        def _step_callback(step: Any) -> None:
            try:
                agent_role = AGENT_ROLES[current_agent_idx[0]] if current_agent_idx[0] < len(AGENT_ROLES) else "Agent"
                if hasattr(step, "tool"):
                    event_queue.put({
                        "event": "tool_call",
                        "agent": agent_role,
                        "agent_index": current_agent_idx[0],
                        "tool": str(step.tool),
                        "tool_input": str(step.tool_input)[:200] if hasattr(step, "tool_input") else "",
                    })
                    if hasattr(step, "thought") and step.thought:
                        event_queue.put({
                            "event": "thinking",
                            "agent": agent_role,
                            "agent_index": current_agent_idx[0],
                            "text": str(step.thought)[:300],
                        })
                elif hasattr(step, "output"):
                    event_queue.put({
                        "event": "thinking",
                        "agent": agent_role,
                        "agent_index": current_agent_idx[0],
                        "text": str(step.output)[:300] if step.output else "Finalizing...",
                    })
            except Exception:
                pass

        def _task_callback(task_output: Any) -> None:
            try:
                idx = current_agent_idx[0]
                agent_role = AGENT_ROLES[idx] if idx < len(AGENT_ROLES) else "Agent"
                summary = ""
                if hasattr(task_output, "raw") and task_output.raw:
                    summary = task_output.raw[:300]
                elif hasattr(task_output, "summary") and task_output.summary:
                    summary = str(task_output.summary)[:300]
                event_queue.put({
                    "event": "task_complete",
                    "agent": agent_role,
                    "agent_index": idx,
                    "summary": summary,
                })
                current_agent_idx[0] = idx + 1
                if current_agent_idx[0] < len(AGENT_ROLES):
                    event_queue.put({
                        "event": "agent_start",
                        "agent": AGENT_ROLES[current_agent_idx[0]],
                        "agent_index": current_agent_idx[0],
                    })
            except Exception:
                pass

        step_cb = _step_callback
        task_cb = _task_callback

    crew_kwargs: dict[str, Any] = {
        "agents": agents,
        "tasks": tasks,
        "process": Process.sequential,
        "verbose": False,
    }
    if step_cb is not None:
        crew_kwargs["step_callback"] = step_cb
    if task_cb is not None:
        crew_kwargs["task_callback"] = task_cb

    crew = Crew(**crew_kwargs)
    return crew, universe_str, has_universe


def generate_trade_proposals(objective: TradingObjective) -> dict[str, Any]:
    """Run the trading crew and return structured proposals."""
    crew, _, _ = _build_crew_components(objective)

    task_outputs: dict[str, str] = {}

    result = crew.kickoff()
    raw_output = str(result)

    for i, task in enumerate(crew.tasks):
        agent_name = task.agent.role if task.agent else f"Agent {i}"
        if task.output and task.output.raw:
            task_outputs[agent_name] = task.output.raw[:1500]

    return _parse_crew_output(raw_output, objective, task_outputs)


def generate_trade_proposals_streaming(
    objective: TradingObjective,
) -> Generator[dict[str, Any], None, None]:
    """Run the trading crew with streaming events via a generator."""
    event_q: queue.Queue[dict[str, Any]] = queue.Queue()

    yield {
        "event": "agent_start",
        "agent": AGENT_ROLES[0],
        "agent_index": 0,
        "agents": AGENT_ROLES,
    }

    import threading

    result_holder: dict[str, Any] = {}
    error_holder: list[str] = []

    def _run_crew() -> None:
        try:
            crew, _, _ = _build_crew_components(objective, event_queue=event_q)
            crew_result = crew.kickoff()
            raw_output = str(crew_result)
            task_outputs: dict[str, str] = {}
            for i, task in enumerate(crew.tasks):
                agent_name = task.agent.role if task.agent else f"Agent {i}"
                if task.output and task.output.raw:
                    task_outputs[agent_name] = task.output.raw[:1500]
            parsed = _parse_crew_output(raw_output, objective, task_outputs)
            result_holder.update(parsed)
        except Exception as e:
            logger.exception("Streaming crew failed")
            error_holder.append(str(e))
        finally:
            event_q.put({"event": "__done__"})

    thread = threading.Thread(target=_run_crew, daemon=True)
    thread.start()

    while True:
        try:
            evt = event_q.get(timeout=1.0)
            if evt.get("event") == "__done__":
                break
            yield evt
        except queue.Empty:
            yield {"event": "heartbeat"}

    thread.join(timeout=5.0)

    if error_holder:
        yield {"event": "error", "message": error_holder[0]}
    else:
        yield {"event": "done", "result": result_holder}


def _parse_crew_output(
    raw_output: str,
    objective: TradingObjective,
    agent_reasoning: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Parse the crew's final output into structured proposals."""
    from uuid import uuid4
    batch_id = str(uuid4())
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

                confidence_raw = review.get("confidence", 50)
                try:
                    confidence = max(0, min(100, int(confidence_raw)))
                except (TypeError, ValueError):
                    confidence = 50

                entry_raw = review.get("entry_price")
                target_raw = review.get("price_target")
                stop_raw = review.get("stop_loss")

                def _safe_float(v: Any) -> float | None:
                    if v is None:
                        return None
                    try:
                        return round(float(v), 2)
                    except (TypeError, ValueError):
                        return None

                proposals.append(
                    TradeProposal(
                        batch_id=batch_id,
                        symbol=symbol.upper(),
                        action=action.lower(),
                        qty=qty,
                        rationale=review.get("rationale", reasoning),
                        expected_impact=review.get("expected_impact", ""),
                        risk_level=review.get("risk_level", "medium"),
                        risk_review=reasoning,
                        confidence=confidence,
                        entry_price=_safe_float(entry_raw),
                        price_target=_safe_float(target_raw),
                        stop_loss=_safe_float(stop_raw),
                        time_horizon=review.get("time_horizon", ""),
                        catalyst=review.get("catalyst", ""),
                        technical_summary=review.get("technical_summary", ""),
                        agent_reasoning=agent_reasoning or {},
                        status=status,
                    )
                )
    except (json.JSONDecodeError, KeyError, TypeError) as e:
        logger.warning("Failed to parse crew output: %s", e)

    if not proposals:
        proposals = _fallback_parse(raw_output, agent_reasoning)

    saved = save_proposals_batch(proposals) if proposals else []

    return {
        "objective": objective.goal,
        "proposals": saved,
        "total": len(saved),
        "approved": sum(1 for p in saved if p.get("status") == "pending"),
        "rejected": sum(1 for p in saved if p.get("status") == "rejected"),
        "universe_suggestions": universe_suggestions,
        "agent_reasoning": agent_reasoning or {},
        "raw_output": raw_output[:2000],
    }


def _fallback_parse(
    raw_output: str,
    agent_reasoning: dict[str, str] | None = None,
) -> list[TradeProposal]:
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
                            def _safe_float(v: Any) -> float | None:
                                if v is None:
                                    return None
                                try:
                                    return round(float(v), 2)
                                except (TypeError, ValueError):
                                    return None

                            proposals.append(
                                TradeProposal(
                                    symbol=item["symbol"].upper(),
                                    action=item.get("action", "buy"),
                                    qty=int(item.get("qty", 1)),
                                    rationale=item.get("rationale", item.get("reasoning", "")),
                                    expected_impact=item.get("expected_impact", ""),
                                    risk_level=item.get("risk_level", "medium"),
                                    risk_review=item.get("reasoning", item.get("verdict", "")),
                                    confidence=int(item.get("confidence", 50)),
                                    entry_price=_safe_float(item.get("entry_price")),
                                    price_target=_safe_float(item.get("price_target")),
                                    stop_loss=_safe_float(item.get("stop_loss")),
                                    time_horizon=item.get("time_horizon", ""),
                                    catalyst=item.get("catalyst", ""),
                                    technical_summary=item.get("technical_summary", ""),
                                    agent_reasoning=agent_reasoning or {},
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
