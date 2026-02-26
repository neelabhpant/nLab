"""Vault API endpoints — document upload, search, and chat."""

import logging
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from app.services.auth import get_current_user
from app.services.vault_storage import VaultStorage
from app.services.vault_processor import VaultProcessor
from app.services.vault_memory import VaultMemory
from app.services.vault_chat import VaultChat

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vault", tags=["vault"])

ALLOWED_EXTENSIONS = {"pdf", "csv", "txt", "docx", "doc", "png", "jpg", "jpeg", "webp"}
MAX_FILE_SIZE = 20 * 1024 * 1024

_storage: VaultStorage | None = None
_memory: VaultMemory | None = None
_processor: VaultProcessor | None = None
_chat: VaultChat | None = None


def init_vault(storage: VaultStorage, memory: VaultMemory | None) -> None:
    """Initialize vault singleton instances. Called from main.py startup."""
    global _storage, _memory, _processor, _chat
    _storage = storage
    _memory = memory
    _processor = VaultProcessor(storage, memory)
    _chat = VaultChat(storage, memory)


def _get_storage() -> VaultStorage:
    if not _storage:
        raise HTTPException(status_code=503, detail="Vault not initialized")
    return _storage


def _get_processor() -> VaultProcessor:
    if not _processor:
        raise HTTPException(status_code=503, detail="Vault not initialized")
    return _processor


def _get_chat() -> VaultChat:
    if not _chat:
        raise HTTPException(status_code=503, detail="Vault not initialized")
    return _chat


class UploadResponse(BaseModel):
    """Response for document upload."""
    id: str
    filename: str
    status: str


class DocumentSummary(BaseModel):
    """Document list item."""
    id: str
    filename: str
    file_type: str
    file_size: Optional[int] = None
    doc_type: Optional[str] = None
    title: Optional[str] = None
    summary: Optional[str] = None
    status: str
    created_at: Optional[str] = None


class ChatRequest(BaseModel):
    """Vault chat request."""
    message: str


class SearchResult(BaseModel):
    """Search result item."""
    doc_id: Optional[str] = None
    title: Optional[str] = None
    filename: Optional[str] = None
    snippet: Optional[str] = None
    source: str


@router.post("/upload", response_model=UploadResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
) -> UploadResponse:
    """Upload a document for processing."""
    storage = _get_storage()
    processor = _get_processor()

    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = Path(file.filename).suffix.lower().lstrip(".")
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: .{ext}. Allowed: {', '.join('.' + e for e in sorted(ALLOWED_EXTENSIONS))}",
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 20MB.")

    doc_id = await storage.save_document(file.filename, file_bytes, user["email"])

    background_tasks.add_task(_process_in_background, processor, doc_id)

    return UploadResponse(id=doc_id, filename=file.filename, status="processing")


async def _process_in_background(processor: VaultProcessor, doc_id: str) -> None:
    """Wrapper for background document processing."""
    try:
        await processor.process_document(doc_id)
    except Exception:
        logger.exception("Background processing failed for %s", doc_id)


@router.get("/documents")
async def list_documents(
    doc_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: dict = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """List documents for the current user."""
    storage = _get_storage()
    return await storage.list_documents(
        user_email=user["email"],
        doc_type=doc_type,
        search=search,
        limit=limit,
        offset=offset,
    )


@router.get("/documents/{doc_id}")
async def get_document(
    doc_id: str,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Get full document details."""
    storage = _get_storage()
    doc = await storage.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc["user_email"] != user["email"]:
        raise HTTPException(status_code=403, detail="Access denied")
    return doc


@router.delete("/documents/{doc_id}")
async def delete_document(
    doc_id: str,
    user: dict = Depends(get_current_user),
) -> dict[str, str]:
    """Delete a document."""
    storage = _get_storage()
    doc = await storage.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc["user_email"] != user["email"]:
        raise HTTPException(status_code=403, detail="Access denied")

    await storage.delete_document(doc_id)

    if _memory:
        try:
            _memory.delete_document(doc_id, user["email"])
        except Exception:
            logger.warning("Mem0 delete failed for doc %s", doc_id)

    return {"status": "deleted"}


@router.get("/search")
async def search_documents(
    q: str = Query(..., min_length=1),
    user: dict = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Hybrid search across vault documents."""
    storage = _get_storage()
    results: list[dict[str, Any]] = []

    if _memory and _memory.available:
        try:
            mem_results = _memory.search(q, user["email"], limit=10)
            for mem in mem_results:
                text = mem.get("memory", mem.get("text", ""))
                meta = mem.get("metadata", {})
                results.append({
                    "doc_id": meta.get("doc_id"),
                    "title": meta.get("title"),
                    "snippet": text[:300] if text else "",
                    "source": "memory",
                })
        except Exception:
            logger.warning("Mem0 search failed")

    sql_results = await storage.search_text(user["email"], q, limit=5)
    for doc in sql_results:
        results.append({
            "doc_id": doc.get("id"),
            "title": doc.get("title"),
            "filename": doc.get("filename"),
            "snippet": doc.get("snippet", doc.get("summary", "")),
            "source": "database",
        })

    return results


@router.post("/chat", response_model=None)
async def vault_chat(
    request: ChatRequest,
    user: dict = Depends(get_current_user),
) -> StreamingResponse | JSONResponse:
    """Chat with your documents via SSE."""
    chat = _get_chat()
    if not request.message.strip():
        return JSONResponse(
            status_code=400,
            content={"error": "Empty message", "detail": "message must not be empty"},
        )

    return StreamingResponse(
        chat.chat(request.message, user["email"]),
        media_type="text/event-stream",
    )


@router.get("/stats")
async def get_stats(
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Get document vault statistics."""
    storage = _get_storage()
    return await storage.get_stats(user["email"])
