"""Portfolio advisor API endpoints."""

from typing import Any, Optional

from fastapi import APIRouter
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from app.services.portfolio_advisor import (
    generate_portfolio_recommendation,
    stream_portfolio_chat,
)

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


class GoalsAnswers(BaseModel):
    """Step 1: Investment goals."""

    selected: list[str] = Field(default_factory=list)
    description: str = ""


class TimelineAnswers(BaseModel):
    """Step 2: Timeline."""

    horizon: str = ""
    target_date: Optional[str] = None


class RiskAnswers(BaseModel):
    """Step 3: Risk tolerance."""

    drawdown_reaction: str = ""
    investment_preference: str = ""
    experience: str = ""
    score: int = 5


class Holding(BaseModel):
    """A single portfolio holding."""

    account_type: str = ""
    asset: str = ""
    value: float = 0


class PortfolioAnswers(BaseModel):
    """Step 4: Current portfolio."""

    has_investments: bool = False
    holdings: list[Holding] = Field(default_factory=list)
    monthly_investment: float = 0


class PreferencesAnswers(BaseModel):
    """Step 5: Preferences and constraints."""

    avoid: list[str] = Field(default_factory=list)
    include: list[str] = Field(default_factory=list)
    tax_situation: str = ""


class QuestionnaireRequest(BaseModel):
    """Complete questionnaire answers."""

    goals: GoalsAnswers = Field(default_factory=GoalsAnswers)
    timeline: TimelineAnswers = Field(default_factory=TimelineAnswers)
    risk: RiskAnswers = Field(default_factory=RiskAnswers)
    portfolio: PortfolioAnswers = Field(default_factory=PortfolioAnswers)
    preferences: PreferencesAnswers = Field(default_factory=PreferencesAnswers)


class AllocationItem(BaseModel):
    """Single allocation entry."""

    asset_class: str
    percentage: float
    funds: list[str]
    rationale: str


class MonthlyBreakdown(BaseModel):
    """Monthly investment breakdown per fund."""

    fund: str
    amount: float


class MonthlyPlan(BaseModel):
    """Monthly investment plan."""

    total: float
    breakdown: list[MonthlyBreakdown]


class ExpectedReturns(BaseModel):
    """Expected return scenarios."""

    conservative: float
    moderate: float
    aggressive: float


class PortfolioRecommendation(BaseModel):
    """Full portfolio recommendation response."""

    allocation: list[AllocationItem]
    monthly_plan: MonthlyPlan
    risk_score: int
    risk_analysis: str
    expected_returns: ExpectedReturns
    key_risks: list[str]
    tax_notes: str
    rebalancing_schedule: str
    summary: str


class ChatMessage(BaseModel):
    """Single chat message."""

    role: str
    content: str


class PortfolioChatRequest(BaseModel):
    """Follow-up chat request with recommendation context."""

    messages: list[ChatMessage]
    recommendation: Optional[dict[str, Any]] = None


@router.post("/recommend")
async def recommend_portfolio(request: QuestionnaireRequest) -> JSONResponse:
    """Generate a portfolio recommendation from questionnaire answers."""
    answers = request.model_dump()

    try:
        result = await generate_portfolio_recommendation(answers)
        return JSONResponse(content=result)
    except Exception as e:
        return JSONResponse(
            status_code=502,
            content={"error": "Recommendation generation failed", "detail": str(e)},
        )


@router.post("/chat", response_model=None)
async def portfolio_chat(request: PortfolioChatRequest) -> StreamingResponse | JSONResponse:
    """Stream follow-up portfolio chat responses via SSE."""
    if not request.messages:
        return JSONResponse(
            status_code=400,
            content={"error": "No messages provided", "detail": "messages array must not be empty"},
        )

    messages_dicts = [m.model_dump() for m in request.messages]

    return StreamingResponse(
        stream_portfolio_chat(messages_dicts, request.recommendation),
        media_type="text/event-stream",
    )
