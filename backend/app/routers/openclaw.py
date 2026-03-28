"""OpenClaw Lite router — chat with a single AI agent powered by configurable skills."""

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from app.services.openclaw_agent import (
    DEFAULT_SKILLS,
    GENERATED_FILES_DIR,
    ChatRequest,
    SkillDefinition,
    abort_session,
    resolve_confirmation,
    stream_chat,
)

router = APIRouter(tags=["openclaw"])


@router.get("/openclaw/skills")
async def get_default_skills() -> list[dict]:
    """Return the default skill definitions."""
    return [s.model_dump() for s in DEFAULT_SKILLS]


@router.post("/openclaw/chat")
async def chat(body: ChatRequest) -> StreamingResponse:
    """Stream a chat response with skill execution events."""
    if not body.messages:
        return StreamingResponse(
            iter(["data: {\"type\": \"error\", \"content\": \"No messages provided\"}\n\ndata: [DONE]\n\n"]),
            media_type="text/event-stream",
        )
    return StreamingResponse(
        stream_chat(body),
        media_type="text/event-stream",
    )


@router.get("/openclaw/files/{file_id}")
async def download_file(file_id: str) -> FileResponse:
    """Download a generated file by its ID."""
    path = GENERATED_FILES_DIR / file_id
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    if not str(path.resolve()).startswith(str(GENERATED_FILES_DIR.resolve())):
        raise HTTPException(status_code=403, detail="Access denied")

    media_type = "application/pdf" if file_id.endswith(".pdf") else "text/csv"
    download_name = file_id.rsplit("_", 1)[0] + ("." + file_id.rsplit(".", 1)[-1])
    return FileResponse(
        path=str(path),
        media_type=media_type,
        filename=download_name,
    )


class AbortBody(BaseModel):
    session_id: str


@router.post("/openclaw/abort")
async def abort(body: AbortBody) -> dict:
    """Abort a running OpenClaw session."""
    ok = abort_session(body.session_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Session not found or already finished")
    return {"status": "aborted"}


class ConfirmationBody(BaseModel):
    approved: bool


@router.post("/openclaw/confirm/{confirmation_id}")
async def confirm_action(confirmation_id: str, body: ConfirmationBody) -> dict:
    """Approve or deny a pending confirmation request."""
    ok = resolve_confirmation(confirmation_id, body.approved)
    if not ok:
        raise HTTPException(status_code=404, detail="Confirmation not found or expired")
    return {"status": "approved" if body.approved else "denied"}
