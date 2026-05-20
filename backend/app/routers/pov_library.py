"""POV Library REST endpoints. See NEWSLETTER_COMPOSER_SPEC.md §6."""

from __future__ import annotations

import mimetypes
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse

from app.models.pov import POV, POVCreate, POVUpdate
from app.services.pov_library import pov_library_service
from app.services.storage import get_storage

router = APIRouter(prefix="/pov-library", tags=["pov-library"])

# Seed file lives alongside backend/data/seed/ — resolved relative to project root.
SEED_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "seed" / "pov_library_seed.json"

MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_SCREENSHOT_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}


@router.get("", response_model=list[POV])
async def list_povs(
    tag: Optional[str] = Query(default=None),
    account: Optional[str] = Query(default=None),
) -> list[POV]:
    """List POVs, optionally filtered by tag or target account."""
    return await pov_library_service.list_povs(tag=tag, account=account)


@router.get("/{pov_id}", response_model=POV)
async def get_pov(pov_id: str) -> POV:
    pov = await pov_library_service.get_pov(pov_id)
    if not pov:
        raise HTTPException(status_code=404, detail="POV not found")
    return pov


@router.post("", response_model=POV, status_code=201)
async def create_pov(body: POVCreate) -> POV:
    return await pov_library_service.create_pov(body)


@router.put("/{pov_id}", response_model=POV)
async def update_pov(pov_id: str, body: POVUpdate) -> POV:
    updated = await pov_library_service.update_pov(pov_id, body)
    if not updated:
        raise HTTPException(status_code=404, detail="POV not found")
    return updated


@router.delete("/{pov_id}", status_code=204)
async def delete_pov(pov_id: str) -> None:
    deleted = await pov_library_service.delete_pov(pov_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="POV not found")


@router.post("/{pov_id}/screenshot", response_model=POV)
async def upload_screenshot(pov_id: str, file: UploadFile = File(...)) -> POV:
    """Upload a screenshot for a POV and update the record's demo_screenshot_path."""
    if file.content_type not in ALLOWED_SCREENSHOT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image type: {file.content_type}. Allowed: {sorted(ALLOWED_SCREENSHOT_TYPES)}",
        )

    pov = await pov_library_service.get_pov(pov_id)
    if not pov:
        raise HTTPException(status_code=404, detail="POV not found")

    data = await file.read()
    if len(data) > MAX_SCREENSHOT_BYTES:
        raise HTTPException(status_code=400, detail="Screenshot exceeds 5 MB limit")

    await pov_library_service.upload_screenshot(pov_id, data, file.filename or "screenshot.png")
    refreshed = await pov_library_service.get_pov(pov_id)
    if not refreshed:
        # Practically unreachable — we just wrote it.
        raise HTTPException(status_code=500, detail="POV missing after upload")
    return refreshed


@router.get("/{pov_id}/screenshot")
async def get_screenshot(pov_id: str) -> FileResponse:
    """Serve the stored screenshot for a POV."""
    pov = await pov_library_service.get_pov(pov_id)
    if not pov or not pov.demo_screenshot_path:
        raise HTTPException(status_code=404, detail="Screenshot not found")

    storage = get_storage()
    try:
        # Resolve to an actual filesystem path via the storage layer.
        local_path = await storage.file_url(pov.demo_screenshot_path)
    except (ValueError, FileNotFoundError):
        raise HTTPException(status_code=404, detail="Screenshot not found")

    if not Path(local_path).exists():
        raise HTTPException(status_code=404, detail="Screenshot not found")

    media_type, _ = mimetypes.guess_type(local_path)
    return FileResponse(path=local_path, media_type=media_type or "application/octet-stream")


@router.post("/seed", response_model=dict)
async def seed_pov_library() -> dict:
    """Idempotent seed loader. Skips POVs whose id already exists."""
    loaded = await pov_library_service.seed_from_file(SEED_PATH)
    total = len(await pov_library_service.list_povs())
    return {"loaded": loaded, "total": total, "seed_path": str(SEED_PATH)}
