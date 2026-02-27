"""Pydantic models and JSON persistence for Agent Workshop sessions."""

import json
import logging
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
SESSIONS_PATH = DATA_DIR / "workshop_sessions.json"

MAX_SESSIONS = 50


class EventType(str, Enum):
    AGENT_START = "agent_start"
    AGENT_THINKING = "agent_thinking"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    HANDOFF = "handoff"
    AGENT_COMPLETE = "agent_complete"
    CREW_COMPLETE = "crew_complete"
    ERROR = "error"


class SessionStatus(str, Enum):
    PLANNING = "planning"
    RUNNING = "running"
    COMPLETE = "complete"
    ERROR = "error"


class WorkshopGoal(BaseModel):
    user_goal: str | None = None
    template_id: str | None = None


class AgentDefinition(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    role: str
    goal: str
    backstory: str
    tools: list[str] = Field(default_factory=list)
    order: int = 0


class TaskDefinition(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    description: str
    agent_id: str
    expected_output: str
    order: int = 0


class CrewPlan(BaseModel):
    agents: list[AgentDefinition] = Field(default_factory=list)
    tasks: list[TaskDefinition] = Field(default_factory=list)
    execution_order: str = "sequential"
    summary: str = ""


class ExecutionEvent(BaseModel):
    type: EventType
    agent_name: str = ""
    content: str = ""
    timestamp: float = Field(default_factory=lambda: datetime.now(timezone.utc).timestamp())
    metadata: dict[str, Any] = Field(default_factory=dict)


class WorkshopSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    goal: str
    crew_plan: CrewPlan = Field(default_factory=CrewPlan)
    events: list[ExecutionEvent] = Field(default_factory=list)
    result: str = ""
    execution_time_seconds: float = 0.0
    total_tokens: int = 0
    status: SessionStatus = SessionStatus.PLANNING
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


def _load_json(path: Path) -> Any:
    if path.exists():
        try:
            return json.loads(path.read_text())
        except (json.JSONDecodeError, OSError):
            logger.warning("Failed to read %s", path)
    return None


def _save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2))


def save_session(session: WorkshopSession) -> dict[str, Any]:
    sessions = list_sessions()
    data = session.model_dump()
    existing_idx = next(
        (i for i, s in enumerate(sessions) if s.get("id") == session.id), None
    )
    if existing_idx is not None:
        sessions[existing_idx] = data
    else:
        sessions.insert(0, data)
    sessions = sessions[:MAX_SESSIONS]
    _save_json(SESSIONS_PATH, sessions)
    return data


def list_sessions() -> list[dict[str, Any]]:
    data = _load_json(SESSIONS_PATH)
    if not isinstance(data, list):
        return []
    return data


def get_session(session_id: str) -> dict[str, Any] | None:
    for s in list_sessions():
        if s.get("id") == session_id:
            return s
    return None
