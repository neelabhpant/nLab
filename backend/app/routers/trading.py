"""Trading endpoints — Alpaca paper trading."""

import logging

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.services.alpaca_client import (
    cancel_order,
    get_account,
    get_orders,
    get_portfolio_history,
    get_position,
    get_positions,
    place_order,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["trading"])


class OrderRequest(BaseModel):
    """Request body for placing an order."""

    symbol: str
    qty: float
    side: str
    order_type: str = "market"
    time_in_force: str = "day"
    limit_price: float | None = None


@router.get("/trading/account")
async def trading_account() -> dict:
    """Get paper trading account summary."""
    try:
        return get_account()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("Failed to fetch trading account")
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/trading/positions")
async def trading_positions() -> list[dict]:
    """Get all open positions."""
    try:
        return get_positions()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("Failed to fetch positions")
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/trading/orders")
async def trading_place_order(req: OrderRequest) -> dict:
    """Place a paper trade order."""
    try:
        return place_order(
            symbol=req.symbol,
            qty=req.qty,
            side=req.side,
            order_type=req.order_type,
            time_in_force=req.time_in_force,
            limit_price=req.limit_price,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("Failed to place order")
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/trading/orders")
async def trading_list_orders(
    status: str = Query("open", description="Order status: open, closed, all"),
) -> list[dict]:
    """List orders by status."""
    try:
        return get_orders(status)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("Failed to fetch orders")
        raise HTTPException(status_code=502, detail=str(e))


@router.delete("/trading/orders/{order_id}")
async def trading_cancel_order(order_id: str) -> dict:
    """Cancel an open order."""
    try:
        return cancel_order(order_id)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("Failed to cancel order %s", order_id)
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/trading/history")
async def trading_history(
    period: str = Query("1M", description="Period: 1D, 1W, 1M, 3M, 1A"),
    timeframe: str = Query("1D", description="Timeframe: 1Min, 5Min, 15Min, 1H, 1D"),
) -> dict:
    """Get portfolio performance history."""
    try:
        return get_portfolio_history(period, timeframe)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("Failed to fetch portfolio history")
        raise HTTPException(status_code=502, detail=str(e))
