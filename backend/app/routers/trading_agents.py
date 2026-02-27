"""Trading agents endpoints — objective-driven trade proposals."""

import asyncio
import logging

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.models.trading_objectives import (
    ObjectiveStatus,
    ProposalStatus,
    RiskTolerance,
    TradingObjective,
    TradeProposal,
    load_objective,
    load_proposals,
    save_objective,
    update_proposal_status,
)
from app.services.alpaca_client import place_order
from app.services.trading_agents import generate_trade_proposals

logger = logging.getLogger(__name__)

router = APIRouter(tags=["trading-agents"])


class ObjectiveRequest(BaseModel):
    """Request body for creating/updating a trading objective."""

    goal: str
    target_return_pct: float
    timeframe_days: int
    risk_tolerance: RiskTolerance = RiskTolerance.MODERATE
    max_position_pct: float = 30.0
    asset_universe: list[str] = []
    max_daily_loss_pct: float = 2.0
    status: ObjectiveStatus = ObjectiveStatus.ACTIVE


@router.post("/trading/objectives")
async def create_objective(req: ObjectiveRequest) -> dict:
    """Create or update the trading objective."""
    obj = TradingObjective(**req.model_dump())
    return save_objective(obj)


@router.get("/trading/objectives")
async def get_objective() -> dict:
    """Get the current trading objective."""
    obj = load_objective()
    if not obj:
        raise HTTPException(status_code=404, detail="No trading objective configured")
    return obj


@router.post("/trading/proposals/generate")
async def trigger_proposal_generation() -> dict:
    """Trigger the AI crew to analyze and generate trade proposals."""
    obj_data = load_objective()
    if not obj_data:
        raise HTTPException(
            status_code=400,
            detail="No trading objective configured. Create one first.",
        )

    if obj_data.get("status") != "active":
        raise HTTPException(
            status_code=400, detail="Trading objective is not active."
        )

    objective = TradingObjective(**obj_data)

    try:
        result = await asyncio.to_thread(generate_trade_proposals, objective)
        return result
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("Proposal generation failed")
        raise HTTPException(status_code=502, detail=f"Crew execution failed: {e}")


@router.get("/trading/proposals")
async def list_proposals(
    status: str | None = Query(None, description="Filter by status: pending, approved, rejected, executed"),
) -> list[dict]:
    """List all trade proposals, optionally filtered by status."""
    return load_proposals(status)


@router.post("/trading/proposals/{proposal_id}/approve")
async def approve_proposal(proposal_id: str) -> dict:
    """Approve a pending trade proposal."""
    updated = update_proposal_status(proposal_id, ProposalStatus.APPROVED)
    if not updated:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return updated


@router.post("/trading/proposals/{proposal_id}/reject")
async def reject_proposal(proposal_id: str) -> dict:
    """Reject a pending trade proposal."""
    updated = update_proposal_status(proposal_id, ProposalStatus.REJECTED)
    if not updated:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return updated


@router.post("/trading/proposals/{proposal_id}/execute")
async def execute_proposal(proposal_id: str) -> dict:
    """Execute an approved trade proposal via Alpaca."""
    proposals = load_proposals()
    proposal = next((p for p in proposals if p.get("id") == proposal_id), None)

    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    if proposal.get("status") != "approved":
        raise HTTPException(
            status_code=400,
            detail=f"Proposal must be approved before execution. Current status: {proposal.get('status')}",
        )

    try:
        order = place_order(
            symbol=proposal["symbol"],
            qty=float(proposal["qty"]),
            side=proposal["action"],
        )
        update_proposal_status(proposal_id, ProposalStatus.EXECUTED)
        return {"proposal_id": proposal_id, "order": order, "status": "executed"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("Failed to execute proposal %s", proposal_id)
        raise HTTPException(status_code=502, detail=str(e))
