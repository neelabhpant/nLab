"""Alpaca paper trading client — wraps alpaca-py SDK."""

import logging
from typing import Any

import httpx
from alpaca.trading.client import TradingClient
from alpaca.trading.enums import OrderSide, OrderType, TimeInForce, QueryOrderStatus
from alpaca.trading.requests import (
    GetOrdersRequest,
    LimitOrderRequest,
    MarketOrderRequest,
)

from app.config import get_settings

logger = logging.getLogger(__name__)

_client: TradingClient | None = None


def _get_client() -> TradingClient:
    """Return a cached TradingClient instance."""
    global _client
    if _client is None:
        s = get_settings()
        if not s.alpaca_api_key or not s.alpaca_secret_key:
            raise RuntimeError("Alpaca API keys not configured")
        _client = TradingClient(
            api_key=s.alpaca_api_key,
            secret_key=s.alpaca_secret_key,
            paper=True,
        )
    return _client


def get_account() -> dict[str, Any]:
    """Return account summary."""
    acct = _get_client().get_account()
    return {
        "id": str(acct.id),
        "status": acct.status.value if hasattr(acct.status, "value") else str(acct.status),
        "currency": acct.currency,
        "buying_power": str(acct.buying_power),
        "cash": str(acct.cash),
        "portfolio_value": str(acct.portfolio_value),
        "equity": str(acct.equity),
        "last_equity": str(acct.last_equity),
        "long_market_value": str(acct.long_market_value),
        "short_market_value": str(acct.short_market_value),
        "initial_margin": str(acct.initial_margin),
        "maintenance_margin": str(acct.maintenance_margin),
        "daytrade_count": acct.daytrade_count,
        "pattern_day_trader": acct.pattern_day_trader,
    }


def get_positions() -> list[dict[str, Any]]:
    """Return all open positions."""
    positions = _get_client().get_all_positions()
    return [_position_to_dict(p) for p in positions]


def get_position(symbol: str) -> dict[str, Any]:
    """Return a single position by symbol."""
    pos = _get_client().get_open_position(symbol.upper())
    return _position_to_dict(pos)


def _position_to_dict(pos: Any) -> dict[str, Any]:
    """Convert an Alpaca Position object to a clean dict."""
    return {
        "asset_id": str(pos.asset_id),
        "symbol": pos.symbol,
        "qty": str(pos.qty),
        "side": pos.side.value if hasattr(pos.side, "value") else str(pos.side),
        "market_value": str(pos.market_value),
        "cost_basis": str(pos.cost_basis),
        "avg_entry_price": str(pos.avg_entry_price),
        "current_price": str(pos.current_price),
        "change_today": str(pos.change_today),
        "unrealized_pl": str(pos.unrealized_pl),
        "unrealized_plpc": str(pos.unrealized_plpc),
        "unrealized_intraday_pl": str(pos.unrealized_intraday_pl),
        "unrealized_intraday_plpc": str(pos.unrealized_intraday_plpc),
    }


def place_order(
    symbol: str,
    qty: float,
    side: str,
    order_type: str = "market",
    time_in_force: str = "day",
    limit_price: float | None = None,
) -> dict[str, Any]:
    """Place a paper trade order."""
    order_side = OrderSide.BUY if side.lower() == "buy" else OrderSide.SELL
    tif = TimeInForce[time_in_force.upper()] if time_in_force else TimeInForce.DAY

    if order_type == "limit":
        if limit_price is None:
            raise ValueError("limit_price required for limit orders")
        req = LimitOrderRequest(
            symbol=symbol.upper(),
            qty=qty,
            side=order_side,
            time_in_force=tif,
            limit_price=limit_price,
        )
    else:
        req = MarketOrderRequest(
            symbol=symbol.upper(),
            qty=qty,
            side=order_side,
            time_in_force=tif,
        )

    order = _get_client().submit_order(order_data=req)
    return _order_to_dict(order)


def get_orders(status: str = "open") -> list[dict[str, Any]]:
    """List orders by status."""
    status_map = {
        "open": QueryOrderStatus.OPEN,
        "closed": QueryOrderStatus.CLOSED,
        "all": QueryOrderStatus.ALL,
    }
    req = GetOrdersRequest(status=status_map.get(status, QueryOrderStatus.OPEN))
    orders = _get_client().get_orders(filter=req)
    return [_order_to_dict(o) for o in orders]


def cancel_order(order_id: str) -> dict[str, str]:
    """Cancel an open order."""
    _get_client().cancel_order_by_id(order_id)
    return {"status": "cancelled", "order_id": order_id}


def _order_to_dict(order: Any) -> dict[str, Any]:
    """Convert an Alpaca Order object to a clean dict."""
    return {
        "id": str(order.id),
        "symbol": order.symbol,
        "qty": str(order.qty),
        "filled_qty": str(order.filled_qty),
        "side": order.side.value if hasattr(order.side, "value") else str(order.side),
        "type": order.type.value if hasattr(order.type, "value") else str(order.type),
        "time_in_force": order.time_in_force.value if hasattr(order.time_in_force, "value") else str(order.time_in_force),
        "status": order.status.value if hasattr(order.status, "value") else str(order.status),
        "limit_price": str(order.limit_price) if order.limit_price else None,
        "filled_avg_price": str(order.filled_avg_price) if order.filled_avg_price else None,
        "submitted_at": str(order.submitted_at) if order.submitted_at else None,
        "filled_at": str(order.filled_at) if order.filled_at else None,
        "created_at": str(order.created_at) if order.created_at else None,
    }


def get_portfolio_history(period: str = "1M", timeframe: str = "1D") -> dict[str, Any]:
    """Fetch portfolio history via REST (not yet in TradingClient)."""
    s = get_settings()
    if not s.alpaca_api_key or not s.alpaca_secret_key:
        raise RuntimeError("Alpaca API keys not configured")

    url = f"{s.alpaca_base_url}/account/portfolio/history"
    headers = {
        "APCA-API-KEY-ID": s.alpaca_api_key,
        "APCA-API-SECRET-KEY": s.alpaca_secret_key,
    }
    params = {"period": period, "timeframe": timeframe}

    resp = httpx.get(url, headers=headers, params=params, timeout=15)
    resp.raise_for_status()
    data = resp.json()

    timestamps = data.get("timestamp", [])
    equity = data.get("equity", [])
    profit_loss = data.get("profit_loss", [])
    profit_loss_pct = data.get("profit_loss_pct", [])

    points = []
    for i in range(len(timestamps)):
        points.append({
            "timestamp": timestamps[i],
            "equity": equity[i] if i < len(equity) else None,
            "profit_loss": profit_loss[i] if i < len(profit_loss) else None,
            "profit_loss_pct": profit_loss_pct[i] if i < len(profit_loss_pct) else None,
        })

    return {
        "base_value": data.get("base_value"),
        "timeframe": data.get("timeframe"),
        "points": points,
    }
