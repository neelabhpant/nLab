"""Financial advisor API endpoints."""

from typing import Any, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from app.services.financial_advisor import stream_advisor_response
from app.services.documents import process_document, list_documents, ALLOWED_EXTENSIONS
from app.services.user_profile import get_profile, update_profile, extract_profile_from_conversation

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
