"""CrewAI tools for the portfolio advisor — real market data via yfinance + FRED."""

import json
from typing import Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

from app.services.market_data import (
    compare_etfs,
    get_asset_class_overview,
    get_economic_indicators,
    get_etf_info,
    get_historical_performance,
    get_stock_quote,
)


class GetStockQuoteInput(BaseModel):
    ticker: str = Field(
        ...,
        description="Stock or ETF ticker symbol, e.g. 'AAPL', 'VOO', 'BND', 'VNQ'",
    )


class GetStockQuoteTool(BaseTool):
    name: str = "get_stock_quote"
    description: str = (
        "Get the current price, P/E ratio, dividend yield, beta, market cap, "
        "52-week range, and sector for any stock or ETF. Use standard ticker "
        "symbols like AAPL, MSFT, VOO, QQQ, BND, VNQ, VXUS, VWO, GLD, IBIT."
    )
    args_schema: Type[BaseModel] = GetStockQuoteInput

    def _run(self, ticker: str) -> str:
        data = get_stock_quote(ticker.strip().upper())
        return json.dumps(data, indent=2, default=str)


class GetETFInfoInput(BaseModel):
    ticker: str = Field(
        ...,
        description="ETF ticker symbol, e.g. 'VOO', 'QQQ', 'BND', 'VNQ', 'VXUS'",
    )


class GetETFInfoTool(BaseTool):
    name: str = "get_etf_info"
    description: str = (
        "Get detailed ETF information including expense ratio, top holdings, "
        "category, yield, YTD return, 3-year and 5-year returns, and total assets. "
        "Essential for comparing ETFs when building portfolio allocations."
    )
    args_schema: Type[BaseModel] = GetETFInfoInput

    def _run(self, ticker: str) -> str:
        data = get_etf_info(ticker.strip().upper())
        return json.dumps(data, indent=2, default=str)


class GetHistoricalPerformanceInput(BaseModel):
    ticker: str = Field(
        ...,
        description="Stock or ETF ticker symbol",
    )
    period: str = Field(
        "1y",
        description="Time period: '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'max'. Default '1y'.",
    )


class GetHistoricalPerformanceTool(BaseTool):
    name: str = "get_historical_performance"
    description: str = (
        "Get historical performance data for any stock or ETF including total return, "
        "annualised volatility, max drawdown, and price series. Use this to assess "
        "how a fund has performed over time and evaluate risk-adjusted returns."
    )
    args_schema: Type[BaseModel] = GetHistoricalPerformanceInput

    def _run(self, ticker: str, period: str = "1y") -> str:
        data = get_historical_performance(ticker.strip().upper(), period)
        return json.dumps(data, indent=2, default=str)


class CompareETFsInput(BaseModel):
    tickers: str = Field(
        ...,
        description="Comma-separated ticker symbols to compare, e.g. 'VOO,QQQ,VTI'",
    )
    period: str = Field(
        "1y",
        description="Time period for comparison: '1mo', '3mo', '6mo', '1y', '2y', '5y'. Default '1y'.",
    )


class CompareETFsTool(BaseTool):
    name: str = "compare_etfs"
    description: str = (
        "Compare multiple ETFs or stocks side-by-side on key metrics: return, "
        "volatility, max drawdown, expense ratio, dividend yield, P/E ratio, and beta. "
        "Use this to evaluate which funds best fit the portfolio allocation."
    )
    args_schema: Type[BaseModel] = CompareETFsInput

    def _run(self, tickers: str, period: str = "1y") -> str:
        ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
        data = compare_etfs(ticker_list, period)
        return json.dumps(data, indent=2, default=str)


class GetEconomicIndicatorsInput(BaseModel):
    placeholder: str = Field("", description="Not used — leave empty.")


class GetEconomicIndicatorsTool(BaseTool):
    name: str = "get_economic_indicators"
    description: str = (
        "Get current key economic indicators: Federal Funds Rate, Treasury yields "
        "(2Y, 10Y), yield curve spread, CPI inflation, unemployment rate, GDP growth, "
        "and VIX volatility index. Essential context for asset allocation decisions."
    )
    args_schema: Type[BaseModel] = GetEconomicIndicatorsInput

    def _run(self, **kwargs: str) -> str:
        data = get_economic_indicators()
        return json.dumps(data, indent=2, default=str)


class GetAssetClassOverviewInput(BaseModel):
    placeholder: str = Field("", description="Not used — leave empty.")


class GetAssetClassOverviewTool(BaseTool):
    name: str = "get_asset_class_overview"
    description: str = (
        "Get a snapshot of all major asset class benchmarks: S&P 500, total market, "
        "international, emerging markets, bonds, TIPS, high yield, REITs, gold, and "
        "Bitcoin ETF. Shows current prices, daily changes, and yields. Use this for "
        "a broad market overview before building allocations."
    )
    args_schema: Type[BaseModel] = GetAssetClassOverviewInput

    def _run(self, **kwargs: str) -> str:
        data = get_asset_class_overview()
        return json.dumps(data, indent=2, default=str)
