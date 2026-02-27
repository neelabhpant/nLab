"""Workshop router — plan, execute, and review AI agent crews."""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.models.workshop import (
    CrewPlan,
    WorkshopGoal,
    list_sessions,
    get_session,
)
from app.services.agent_workshop import (
    TEMPLATES,
    plan_crew,
    stream_workshop_events,
)

router = APIRouter(tags=["workshop"])


class TemplateResponse(BaseModel):
    id: str
    title: str
    description: str
    goal: str


@router.get("/workshop/templates")
async def get_templates() -> list[TemplateResponse]:
    return [
        TemplateResponse(id=tid, **tdata)
        for tid, tdata in TEMPLATES.items()
    ]


@router.post("/workshop/plan")
async def create_plan(body: WorkshopGoal) -> dict:
    goal = body.user_goal
    if body.template_id:
        template = TEMPLATES.get(body.template_id)
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        goal = template["goal"]

    if not goal or not goal.strip():
        raise HTTPException(status_code=400, detail="A goal is required")

    plan = await plan_crew(goal.strip())
    return plan.model_dump()


@router.post("/workshop/plan/edit")
async def edit_plan(plan: CrewPlan) -> dict:
    if not plan.agents:
        raise HTTPException(status_code=400, detail="At least one agent is required")
    if not plan.tasks:
        raise HTTPException(status_code=400, detail="At least one task is required")
    agent_ids = {a.id for a in plan.agents}
    for task in plan.tasks:
        if task.agent_id not in agent_ids:
            raise HTTPException(
                status_code=400,
                detail=f"Task references unknown agent_id: {task.agent_id}",
            )
    return plan.model_dump()


class ExecuteRequest(BaseModel):
    plan: CrewPlan
    goal: str = ""


@router.post("/workshop/execute")
async def execute(body: ExecuteRequest) -> StreamingResponse:
    if not body.plan.agents or not body.plan.tasks:
        raise HTTPException(status_code=400, detail="Plan must have agents and tasks")
    return StreamingResponse(
        stream_workshop_events(body.plan, body.goal),
        media_type="text/event-stream",
    )


@router.get("/workshop/sessions")
async def get_sessions() -> list[dict]:
    sessions = list_sessions()
    return [
        {
            "id": s.get("id"),
            "goal": s.get("goal", ""),
            "status": s.get("status", ""),
            "created_at": s.get("created_at", ""),
            "execution_time_seconds": s.get("execution_time_seconds", 0),
        }
        for s in sessions
    ]


@router.get("/workshop/sessions/{session_id}")
async def get_session_detail(session_id: str) -> dict:
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session
