"""Market data service — real-time stock, ETF, bond, and economic data via yfinance + FRED."""

import logging
import time
from typing import Any

import yfinance as yf

from app.config import get_settings

logger = logging.getLogger(__name__)

_cache: dict[str, tuple[float, Any]] = {}
CACHE_SHORT = 300
CACHE_LONG = 1800


def _get_cached(key: str, ttl: int) -> Any | None:
    if key in _cache:
        ts, data = _cache[key]
        if time.time() - ts < ttl:
            return data
    return None


def _set_cache(key: str, data: Any) -> None:
    _cache[key] = (time.time(), data)


def get_stock_quote(ticker: str) -> dict[str, Any]:
    """Get current quote data for a stock or ETF ticker."""
    key = f"quote:{ticker}"
    cached = _get_cached(key, CACHE_SHORT)
    if cached:
        return cached

    try:
        t = yf.Ticker(ticker)
        info = t.info
        result = {
            "ticker": ticker.upper(),
            "name": info.get("shortName") or info.get("longName", ticker),
            "price": info.get("currentPrice") or info.get("regularMarketPrice"),
            "previous_close": info.get("previousClose"),
            "open": info.get("open") or info.get("regularMarketOpen"),
            "day_high": info.get("dayHigh") or info.get("regularMarketDayHigh"),
            "day_low": info.get("dayLow") or info.get("regularMarketDayLow"),
            "volume": info.get("volume") or info.get("regularMarketVolume"),
            "market_cap": info.get("marketCap"),
            "pe_ratio": info.get("trailingPE"),
            "forward_pe": info.get("forwardPE"),
            "dividend_yield": info.get("dividendYield"),
            "52w_high": info.get("fiftyTwoWeekHigh"),
            "52w_low": info.get("fiftyTwoWeekLow"),
            "50d_avg": info.get("fiftyDayAverage"),
            "200d_avg": info.get("twoHundredDayAverage"),
            "beta": info.get("beta"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
        }
        _set_cache(key, result)
        return result
    except Exception as e:
        logger.warning("Failed to get quote for %s: %s", ticker, e)
        return {"ticker": ticker.upper(), "error": str(e)}


def get_etf_info(ticker: str) -> dict[str, Any]:
    """Get detailed ETF information including expense ratio, holdings, category."""
    key = f"etf:{ticker}"
    cached = _get_cached(key, CACHE_LONG)
    if cached:
        return cached

    try:
        t = yf.Ticker(ticker)
        info = t.info
        result: dict[str, Any] = {
            "ticker": ticker.upper(),
            "name": info.get("shortName") or info.get("longName", ticker),
            "price": info.get("currentPrice") or info.get("regularMarketPrice") or info.get("navPrice"),
            "expense_ratio": info.get("annualReportExpenseRatio"),
            "category": info.get("category"),
            "total_assets": info.get("totalAssets"),
            "yield": info.get("yield"),
            "ytd_return": info.get("ytdReturn"),
            "three_year_return": info.get("threeYearAverageReturn"),
            "five_year_return": info.get("fiveYearAverageReturn"),
            "beta": info.get("beta3Year") or info.get("beta"),
            "52w_high": info.get("fiftyTwoWeekHigh"),
            "52w_low": info.get("fiftyTwoWeekLow"),
        }

        try:
            holdings = t.funds_data.top_holdings
            if holdings is not None and not holdings.empty:
                top = []
                for idx, row in holdings.head(10).iterrows():
                    top.append({
                        "name": str(idx),
                        "weight": round(float(row.get("Holding Percent", 0)) * 100, 2) if "Holding Percent" in row else None,
                    })
                result["top_holdings"] = top
        except Exception:
            pass

        _set_cache(key, result)
        return result
    except Exception as e:
        logger.warning("Failed to get ETF info for %s: %s", ticker, e)
        return {"ticker": ticker.upper(), "error": str(e)}


def get_historical_performance(ticker: str, period: str = "1y") -> dict[str, Any]:
    """Get historical performance data for a ticker.

    Args:
        ticker: Stock/ETF ticker symbol.
        period: yfinance period string — 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, max.
    """
    key = f"hist:{ticker}:{period}"
    cached = _get_cached(key, CACHE_LONG)
    if cached:
        return cached

    try:
        t = yf.Ticker(ticker)
        hist = t.history(period=period)
        if hist.empty:
            return {"ticker": ticker.upper(), "error": "No historical data available"}

        prices = hist["Close"].dropna()
        first_price = float(prices.iloc[0])
        last_price = float(prices.iloc[-1])
        total_return = ((last_price - first_price) / first_price) * 100

        high = float(prices.max())
        low = float(prices.min())
        max_drawdown = ((low - high) / high) * 100

        daily_returns = prices.pct_change().dropna()
        volatility = float(daily_returns.std() * (252 ** 0.5) * 100)

        sampled = prices
        if len(prices) > 60:
            step = max(1, len(prices) // 60)
            sampled = prices.iloc[::step]
            if prices.index[-1] not in sampled.index:
                sampled = sampled._append(prices.iloc[[-1]])

        price_series = [
            {"date": d.strftime("%Y-%m-%d"), "price": round(float(p), 2)}
            for d, p in sampled.items()
        ]

        result = {
            "ticker": ticker.upper(),
            "period": period,
            "total_return_pct": round(total_return, 2),
            "annualized_volatility_pct": round(volatility, 2),
            "max_drawdown_pct": round(max_drawdown, 2),
            "period_high": round(high, 2),
            "period_low": round(low, 2),
            "start_price": round(first_price, 2),
            "end_price": round(last_price, 2),
            "data_points": len(prices),
            "price_series": price_series,
        }
        _set_cache(key, result)
        return result
    except Exception as e:
        logger.warning("Failed to get historical data for %s: %s", ticker, e)
        return {"ticker": ticker.upper(), "error": str(e)}


def compare_etfs(tickers: list[str], period: str = "1y") -> dict[str, Any]:
    """Compare multiple ETFs/stocks on key metrics."""
    key = f"compare:{','.join(sorted(tickers))}:{period}"
    cached = _get_cached(key, CACHE_LONG)
    if cached:
        return cached

    comparisons = []
    for ticker in tickers:
        perf = get_historical_performance(ticker, period)
        quote = get_stock_quote(ticker)
        comparisons.append({
            "ticker": ticker.upper(),
            "name": quote.get("name", ticker),
            "price": quote.get("price"),
            "total_return_pct": perf.get("total_return_pct"),
            "volatility_pct": perf.get("annualized_volatility_pct"),
            "max_drawdown_pct": perf.get("max_drawdown_pct"),
            "expense_ratio": quote.get("expense_ratio"),
            "dividend_yield": quote.get("dividend_yield"),
            "pe_ratio": quote.get("pe_ratio"),
            "beta": quote.get("beta"),
        })

    result = {"period": period, "comparisons": comparisons}
    _set_cache(key, result)
    return result


def get_economic_indicators() -> dict[str, Any]:
    """Get key economic indicators from FRED (Federal Reserve Economic Data)."""
    key = "econ_indicators"
    cached = _get_cached(key, CACHE_LONG)
    if cached:
        return cached

    settings = get_settings()
    fred_key = settings.fred_api_key

    result: dict[str, Any] = {}

    if not fred_key:
        result["note"] = "FRED API key not configured — using yfinance fallback for treasury data"
        try:
            tnx = yf.Ticker("^TNX")
            result["10y_treasury_yield"] = tnx.info.get("regularMarketPrice")
        except Exception:
            pass
        try:
            fvx = yf.Ticker("^FVX")
            result["5y_treasury_yield"] = fvx.info.get("regularMarketPrice")
        except Exception:
            pass
        try:
            irx = yf.Ticker("^IRX")
            result["13w_treasury_yield"] = irx.info.get("regularMarketPrice")
        except Exception:
            pass
        try:
            vix = yf.Ticker("^VIX")
            result["vix"] = vix.info.get("regularMarketPrice")
        except Exception:
            pass
        _set_cache(key, result)
        return result

    try:
        from fredapi import Fred
        fred = Fred(api_key=fred_key)

        indicators = {
            "fed_funds_rate": "FEDFUNDS",
            "10y_treasury_yield": "GS10",
            "2y_treasury_yield": "GS2",
            "10y_2y_spread": None,
            "cpi_yoy": "CPIAUCSL",
            "core_pce": "PCEPILFE",
            "unemployment_rate": "UNRATE",
            "gdp_growth": "A191RL1Q225SBEA",
            "sp500_pe_ratio": "MULTPL/SP500_PE_RATIO_MONTH",
        }

        for name, series_id in indicators.items():
            if series_id is None:
                continue
            try:
                data = fred.get_series(series_id)
                if data is not None and not data.empty:
                    latest = data.dropna().iloc[-1]
                    result[name] = round(float(latest), 2)
            except Exception as e:
                logger.debug("FRED series %s failed: %s", series_id, e)

        if "10y_treasury_yield" in result and "2y_treasury_yield" in result:
            result["10y_2y_spread"] = round(
                result["10y_treasury_yield"] - result["2y_treasury_yield"], 2
            )

        try:
            vix = yf.Ticker("^VIX")
            result["vix"] = vix.info.get("regularMarketPrice")
        except Exception:
            pass

    except Exception as e:
        logger.warning("FRED API failed: %s — falling back to yfinance", e)
        return get_economic_indicators.__wrapped__() if hasattr(get_economic_indicators, "__wrapped__") else {"error": str(e)}

    _set_cache(key, result)
    return result


def get_asset_class_overview() -> dict[str, Any]:
    """Get a snapshot of major asset class benchmarks."""
    key = "asset_overview"
    cached = _get_cached(key, CACHE_SHORT)
    if cached:
        return cached

    benchmarks = {
        "US Large Cap (S&P 500)": "SPY",
        "US Total Market": "VTI",
        "International Developed": "VXUS",
        "Emerging Markets": "VWO",
        "US Aggregate Bond": "BND",
        "Treasury Inflation Protected": "TIP",
        "High Yield Bond": "HYG",
        "Real Estate (REITs)": "VNQ",
        "Gold": "GLD",
        "Bitcoin ETF": "IBIT",
    }

    overview = []
    for name, ticker in benchmarks.items():
        try:
            t = yf.Ticker(ticker)
            info = t.info
            price = info.get("currentPrice") or info.get("regularMarketPrice") or info.get("navPrice")
            prev = info.get("previousClose")
            change_pct = None
            if price and prev and prev != 0:
                change_pct = round(((price - prev) / prev) * 100, 2)
            overview.append({
                "asset_class": name,
                "ticker": ticker,
                "price": price,
                "day_change_pct": change_pct,
                "ytd_return": info.get("ytdReturn"),
                "yield": info.get("yield") or info.get("dividendYield"),
            })
        except Exception as e:
            logger.debug("Benchmark %s failed: %s", ticker, e)
            overview.append({"asset_class": name, "ticker": ticker, "error": str(e)})

    result = {"benchmarks": overview}
    _set_cache(key, result)
    return result
