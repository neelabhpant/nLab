"""POV Library service. CRUD + screenshot storage + seed loader.

All persistence goes through the storage abstraction (see services/storage/).
Feature code never touches SQLite or the filesystem directly. This is the
discipline that makes the v2 cloud migration mechanical.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from app.models.pov import POV, POVCreate, POVUpdate
from app.services.storage import get_storage

logger = logging.getLogger(__name__)

TABLE = "pov_library"
SCREENSHOT_DIR = "pov_screenshots"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return f"pov-{uuid.uuid4().hex[:12]}"


class POVLibraryService:
    """CRUD for the POV Library. Stateless. Methods are coroutines."""

    TABLE = TABLE

    async def list_povs(
        self,
        tag: Optional[str] = None,
        account: Optional[str] = None,
    ) -> list[POV]:
        """Return all POVs. Optional in-memory filter by tag or target account."""
        storage = get_storage()
        rows = await storage.list(TABLE)

        def matches(row: dict) -> bool:
            if tag and tag not in (row.get("tags") or []):
                return False
            if account and account not in (row.get("target_accounts") or []):
                return False
            return True

        return [POV(**r) for r in rows if matches(r)]

    async def get_pov(self, pov_id: str) -> Optional[POV]:
        storage = get_storage()
        row = await storage.get(TABLE, pov_id)
        return POV(**row) if row else None

    async def create_pov(self, data: POVCreate) -> POV:
        """Generate UUID + timestamps, persist."""
        now = _now_iso()
        pov_id = _new_id()
        record = {
            **data.model_dump(),
            "id": pov_id,
            "created_at": now,
            "updated_at": now,
        }
        storage = get_storage()
        await storage.put(TABLE, pov_id, record)
        return POV(**record)

    async def update_pov(self, pov_id: str, data: POVUpdate) -> Optional[POV]:
        """Partial update. Read-modify-write — the storage layer doesn't merge."""
        storage = get_storage()
        existing = await storage.get(TABLE, pov_id)
        if not existing:
            return None
        patch = data.model_dump(exclude_unset=True)
        merged = {**existing, **patch, "id": pov_id, "updated_at": _now_iso()}
        await storage.put(TABLE, pov_id, merged)
        return POV(**merged)

    async def delete_pov(self, pov_id: str) -> bool:
        storage = get_storage()
        existing = await storage.get(TABLE, pov_id)
        if not existing:
            return False
        await storage.delete(TABLE, pov_id)
        return True

    async def upload_screenshot(
        self,
        pov_id: str,
        file_bytes: bytes,
        filename: str,
    ) -> str:
        """Store a screenshot via the storage backend.

        Stores a relative path in the POV row (portable). Resolution to an
        absolute filesystem path (v1) or signed URL (v2) happens in the
        storage layer at read time.
        """
        ext = Path(filename).suffix.lower() or ".png"
        if ext not in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
            raise ValueError(f"Unsupported screenshot extension: {ext}")

        rel_path = f"{SCREENSHOT_DIR}/{pov_id}{ext}"
        storage = get_storage()
        await storage.store_file(rel_path, file_bytes)

        updated = await self.update_pov(
            pov_id,
            POVUpdate(demo_screenshot_path=rel_path),
        )
        if not updated:
            raise ValueError(f"POV not found: {pov_id}")
        return rel_path

    async def seed_from_file(self, seed_path: str | Path) -> int:
        """Load seed POVs from a JSON file.

        Idempotent: each row is keyed by its `id` field; existing rows are
        skipped (not overwritten). Returns the count of newly inserted rows.
        """
        path = Path(seed_path)
        if not path.exists():
            logger.warning("POV seed file not found: %s", path)
            return 0

        data = json.loads(path.read_text())
        if not isinstance(data, list):
            raise ValueError("Seed file must contain a JSON array of POV objects")

        storage = get_storage()
        loaded = 0
        for entry in data:
            pov_id = entry.get("id")
            if not pov_id:
                logger.warning("Skipping seed entry without id: %s", entry.get("name"))
                continue
            if await storage.get(TABLE, pov_id) is not None:
                continue
            # Defensive: ensure timestamps exist; seed file already has them.
            entry.setdefault("created_at", _now_iso())
            entry.setdefault("updated_at", _now_iso())
            await storage.put(TABLE, pov_id, entry)
            loaded += 1
        return loaded


# Default service instance — stateless, safe to share.
pov_library_service = POVLibraryService()
