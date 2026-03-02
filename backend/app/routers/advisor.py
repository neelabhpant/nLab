"""Financial advisor API endpoints."""

import logging
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from app.services.financial_advisor import stream_advisor_response
from app.services.documents import process_document, list_documents, ALLOWED_EXTENSIONS
from app.services.user_profile import get_profile, update_profile, extract_profile_from_conversation

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/advisor", tags=["advisor"])


class ChatMessage(BaseModel):
    """Single chat message."""

    role: str
    content: str


class AdvisorChatRequest(BaseModel):
    """Advisor chat request containing conversation history."""

    messages: list[ChatMessage]


@router.post("/chat", response_model=None)
async def advisor_chat(request: AdvisorChatRequest) -> StreamingResponse | JSONResponse:
    """Stream a financial advisor crew response via SSE."""
    if not request.messages:
        return JSONResponse(
            status_code=400,
            content={"error": "No messages provided", "detail": "messages array must not be empty"},
        )

    messages_dicts = [m.model_dump() for m in request.messages]

    return StreamingResponse(
        stream_advisor_response(messages_dicts),
        media_type="text/event-stream",
    )


class UploadResponse(BaseModel):
    """Document upload and extraction result."""

    id: str
    filename: str
    document_type: str
    summary: str
    financial_data: dict[str, Any]
    profile_updates: Optional[dict[str, Any]] = None
    notable_items: list[str]


@router.post("/upload", response_model=UploadResponse)
async def upload_document(file: UploadFile = File(...)) -> UploadResponse:
    """Upload a financial document for processing and extraction."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    file_bytes = await file.read()
    if len(file_bytes) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 20MB.")

    try:
        result = await process_document(file.filename, file_bytes)
        return UploadResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Document processing failed: {str(e)}")


class ProfileResponse(BaseModel):
    """User financial profile."""

    profile: dict[str, Any]


class ProfileUpdate(BaseModel):
    """Partial profile update."""

    section: str
    data: Any


@router.get("/profile", response_model=ProfileResponse)
async def read_profile() -> ProfileResponse:
    """Return the user's financial profile."""
    return ProfileResponse(profile=get_profile())


@router.put("/profile", response_model=ProfileResponse)
async def update_user_profile(body: ProfileUpdate) -> ProfileResponse:
    """Update a section of the user's financial profile."""
    valid_sections = [
        "personal", "income", "expenses", "assets", "debts",
        "goals", "risk_tolerance", "investment_preferences",
    ]
    if body.section not in valid_sections:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid section '{body.section}'. Must be one of: {', '.join(valid_sections)}",
        )

    updated = update_profile(body.section, body.data)
    return ProfileResponse(profile=updated)


class ExtractProfileRequest(BaseModel):
    """Conversation messages for profile extraction."""

    messages: list[ChatMessage]


@router.post("/extract-profile", response_model=ProfileResponse)
async def extract_profile(request: ExtractProfileRequest) -> ProfileResponse:
    """Extract financial profile data from conversation messages using the LLM."""
    import asyncio

    messages_dicts = [m.model_dump() for m in request.messages]
    profile = await asyncio.to_thread(extract_profile_from_conversation, messages_dicts)
    return ProfileResponse(profile=profile)


class DocumentMeta(BaseModel):
    """Uploaded document metadata."""

    id: str
    filename: str
    document_type: str
    summary: str
    uploaded_at: int


@router.get("/documents", response_model=list[DocumentMeta])
async def get_documents() -> list[DocumentMeta]:
    """List all uploaded documents with metadata."""
    docs = list_documents()
    return [DocumentMeta(
        id=d["id"],
        filename=d["filename"],
        document_type=d.get("document_type", "unknown"),
        summary=d.get("summary", ""),
        uploaded_at=d.get("uploaded_at", 0),
    ) for d in docs]


def _sum_assets(profile: dict[str, Any]) -> float:
    """Sum total asset value from profile."""
    total = 0.0
    assets = profile.get("assets", {})
    if isinstance(assets, dict):
        for k, v in assets.items():
            if k == "accounts" and isinstance(v, list):
                for a in v:
                    if isinstance(a, dict):
                        total += float(a.get("balance", 0) or 0)
            elif isinstance(v, (int, float)):
                total += float(v)
    return total


def _sum_debts(profile: dict[str, Any]) -> tuple[float, float]:
    """Return (total_debt, high_interest_debt) from profile."""
    total = 0.0
    high_interest = 0.0
    debts = profile.get("debts", [])
    if isinstance(debts, list):
        for d in debts:
            if isinstance(d, dict):
                bal = float(d.get("balance", 0) or 0)
                rate = float(d.get("interest_rate", 0) or 0)
                total += bal
                if rate >= 10:
                    high_interest += bal
    return total, high_interest


def _monthly_expenses(profile: dict[str, Any]) -> float:
    """Get total monthly expenses from profile."""
    expenses = profile.get("expenses", {})
    if isinstance(expenses, dict):
        total = float(expenses.get("total_monthly", 0) or 0)
        if total > 0:
            return total
        return sum(float(v) for v in expenses.values() if isinstance(v, (int, float)) and v > 0)
    return 0.0


@router.get("/roadmap")
async def get_roadmap() -> dict[str, Any]:
    """Compute the user's financial roadmap step statuses."""
    profile = get_profile()
    has_profile = bool(
        profile.get("income") or profile.get("expenses") or
        profile.get("assets", {}).get("accounts") or profile.get("debts")
    )

    monthly_exp = _monthly_expenses(profile)
    emergency_target = monthly_exp * 4 if monthly_exp > 0 else 0
    total_assets = _sum_assets(profile)
    total_debt, high_interest_debt = _sum_debts(profile)
    monthly_income_raw = profile.get("income", {})
    monthly_income = 0.0
    if isinstance(monthly_income_raw, dict):
        monthly_income = float(monthly_income_raw.get("total_monthly", 0) or 0)
        if monthly_income == 0:
            annual = float(monthly_income_raw.get("annual_salary", 0) or 0)
            if annual > 0:
                monthly_income = annual / 12

    portfolio_value = 0.0
    positions_count = 0
    try:
        from app.services.alpaca_client import get_account, get_positions
        acct = get_account()
        portfolio_value = float(acct.get("portfolio_value", 0) or 0)
        positions_count = len(get_positions())
    except Exception:
        pass

    savings_rate = 0.0
    if monthly_income > 0 and monthly_exp > 0:
        savings_rate = ((monthly_income - monthly_exp) / monthly_income) * 100

    checking_balance = 0.0
    accounts = profile.get("assets", {}).get("accounts", [])
    if isinstance(accounts, list):
        for a in accounts:
            if isinstance(a, dict):
                atype = str(a.get("type", "")).lower()
                if "check" in atype or "saving" in atype or "cash" in atype:
                    checking_balance += float(a.get("balance", 0) or 0)

    steps = []

    emergency_status = "locked"
    emergency_current = checking_balance
    if not has_profile:
        emergency_status = "locked"
    elif emergency_target > 0 and emergency_current >= emergency_target:
        emergency_status = "completed"
    elif has_profile:
        emergency_status = "in_progress"

    steps.append({
        "id": "emergency_fund",
        "title": "Emergency Fund",
        "subtitle": "3-6 months of expenses saved in accessible cash",
        "status": emergency_status,
        "metric": {
            "current": round(emergency_current),
            "target": round(emergency_target) if emergency_target > 0 else None,
            "label": "saved",
            "format": "currency",
        },
        "action": {
            "label": "Build savings plan",
            "link": "/finance/advisor/financial",
            "prompt": "Help me create an emergency fund savings plan",
        },
    })

    debt_status = "locked"
    if not has_profile:
        debt_status = "locked"
    elif high_interest_debt <= 0:
        debt_status = "completed"
    elif has_profile:
        debt_status = "in_progress"

    steps.append({
        "id": "debt_freedom",
        "title": "Debt Freedom",
        "subtitle": "Eliminate high-interest debt (10%+ APR)",
        "status": debt_status,
        "metric": {
            "current": round(high_interest_debt),
            "target": 0,
            "label": "high-interest debt remaining",
            "format": "currency",
        },
        "action": {
            "label": "Create payoff strategy",
            "link": "/finance/advisor/financial",
            "prompt": "Help me create a debt payoff strategy",
        },
    })

    retirement_status = "locked"
    retirement_accounts = 0.0
    if isinstance(accounts, list):
        for a in accounts:
            if isinstance(a, dict):
                atype = str(a.get("type", "")).lower()
                aname = str(a.get("name", "")).lower()
                if any(kw in atype or kw in aname for kw in ["401k", "ira", "roth", "retirement"]):
                    retirement_accounts += float(a.get("balance", 0) or 0)

    if not has_profile:
        retirement_status = "locked"
    elif retirement_accounts > 0:
        retirement_status = "completed"
    elif emergency_status == "completed" and debt_status == "completed":
        retirement_status = "in_progress"
    elif has_profile:
        retirement_status = "pending"

    steps.append({
        "id": "retirement_foundation",
        "title": "Retirement Foundation",
        "subtitle": "Capture employer 401k match, max IRA contributions",
        "status": retirement_status,
        "metric": {
            "current": round(retirement_accounts),
            "target": None,
            "label": "in retirement accounts",
            "format": "currency",
        },
        "action": {
            "label": "Optimize retirement savings",
            "link": "/finance/advisor/financial",
            "prompt": "Help me optimize my retirement savings strategy",
        },
    })

    portfolio_status = "locked"
    if portfolio_value > 0 and positions_count > 0:
        portfolio_status = "completed"
    elif has_profile and (emergency_status == "completed" or total_assets > 10000):
        portfolio_status = "in_progress"
    elif has_profile:
        portfolio_status = "pending"

    steps.append({
        "id": "portfolio_allocation",
        "title": "Portfolio Allocation",
        "subtitle": "Build a diversified long-term investment portfolio",
        "status": portfolio_status,
        "metric": {
            "current": round(portfolio_value),
            "target": None,
            "label": "portfolio value",
            "format": "currency",
        },
        "action": {
            "label": "Set investment goal",
            "link": "/finance/trading/agents",
        },
    })

    trading_status = "locked"
    if positions_count >= 3:
        trading_status = "completed"
    elif portfolio_value > 0:
        trading_status = "in_progress"
    elif portfolio_status in ("completed", "in_progress"):
        trading_status = "pending"

    steps.append({
        "id": "active_investing",
        "title": "Active Investing",
        "subtitle": "Use AI Trading Agents for tactical opportunities",
        "status": trading_status,
        "metric": {
            "current": positions_count,
            "target": None,
            "label": "active positions",
            "format": "number",
        },
        "action": {
            "label": "Launch AI agents",
            "link": "/finance/trading/agents",
        },
    })

    growth_status = "locked"
    if portfolio_value > 50000:
        growth_status = "in_progress"
    elif trading_status == "completed":
        growth_status = "pending"

    steps.append({
        "id": "wealth_growth",
        "title": "Wealth Growth",
        "subtitle": "Tax optimization, alternative assets, advanced strategies",
        "status": growth_status,
        "metric": {
            "current": round(total_assets + portfolio_value),
            "target": None,
            "label": "total net worth",
            "format": "currency",
        },
        "action": {
            "label": "Explore strategies",
            "link": "/finance/advisor/financial",
            "prompt": "What advanced wealth building strategies should I consider?",
        },
    })

    active_step = 0
    for i, s in enumerate(steps):
        if s["status"] == "in_progress":
            active_step = i
            break
        if s["status"] in ("pending", "locked"):
            active_step = i
            break

    return {
        "steps": steps,
        "active_step": active_step,
        "has_profile": has_profile,
        "summary": {
            "monthly_income": round(monthly_income),
            "monthly_expenses": round(monthly_exp),
            "savings_rate": round(savings_rate, 1),
            "total_assets": round(total_assets),
            "total_debt": round(total_debt),
            "portfolio_value": round(portfolio_value),
        },
    }
