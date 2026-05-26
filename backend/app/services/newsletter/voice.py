"""VoiceService — CRUD + seed loader for the few-shot voice corpus.

Sits on top of the storage abstraction. The `voice_examples` table holds
section-tagged examples that get injected into generation prompts at runtime.
See NEWSLETTER_COMPOSER_SPEC.md §5.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from app.models.voice import (
    SECTION_TYPES,
    SectionType,
    VoiceExample,
    VoiceExampleCreate,
    VoiceExampleUpdate,
)
from app.services.storage import get_storage

logger = logging.getLogger(__name__)

TABLE = "voice_examples"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id(section_type: str) -> str:
    return f"voice-{section_type.replace('_', '-')}-{uuid.uuid4().hex[:8]}"


class VoiceService:
    """Stateless. Methods are coroutines."""

    TABLE = TABLE
    SECTION_TYPES = list(SECTION_TYPES)

    async def list_examples(
        self,
        section_type: Optional[SectionType] = None,
    ) -> list[VoiceExample]:
        storage = get_storage()
        rows = await storage.list(TABLE)
        if section_type is not None:
            rows = [r for r in rows if r.get("section_type") == section_type]
        rows.sort(key=lambda r: r.get("created_at") or "", reverse=True)
        return [VoiceExample(**r) for r in rows]

    async def get_example(self, example_id: str) -> Optional[VoiceExample]:
        storage = get_storage()
        row = await storage.get(TABLE, example_id)
        return VoiceExample(**row) if row else None

    async def add_example(self, data: VoiceExampleCreate) -> VoiceExample:
        row = {
            "id": _new_id(data.section_type),
            "section_type": data.section_type,
            "example_text": data.example_text,
            "source": data.source,
            "notes": data.notes,
            "created_at": _now_iso(),
        }
        storage = get_storage()
        await storage.put(TABLE, row["id"], row)
        return VoiceExample(**row)

    async def update_example(
        self,
        example_id: str,
        data: VoiceExampleUpdate,
    ) -> Optional[VoiceExample]:
        storage = get_storage()
        existing = await storage.get(TABLE, example_id)
        if not existing:
            return None
        patch = data.model_dump(exclude_unset=True)
        merged = {**existing, **patch}
        await storage.put(TABLE, example_id, merged)
        return VoiceExample(**merged)

    async def delete_example(self, example_id: str) -> bool:
        storage = get_storage()
        existing = await storage.get(TABLE, example_id)
        if not existing:
            return False
        await storage.delete(TABLE, example_id)
        return True

    async def add_published_example(
        self,
        section_type: SectionType,
        example_text: str,
        source: Optional[str] = None,
    ) -> VoiceExample:
        """Add an example harvested from a shipped issue (spec §5.4).

        Flagged from_published_issue=True so it is preferred in few-shot
        selection over seed examples.
        """
        row = {
            "id": _new_id(section_type),
            "section_type": section_type,
            "example_text": example_text,
            "source": source,
            "notes": None,
            "created_at": _now_iso(),
            "from_published_issue": 1,
        }
        storage = get_storage()
        await storage.put(TABLE, row["id"], row)
        return VoiceExample(**row)

    async def get_few_shot_examples(
        self,
        section_type: SectionType,
        limit: int = 5,
    ) -> list[str]:
        """Return just the example_text strings, ready for prompt injection.

        Published examples (from shipped issues) are preferred over seed
        examples; within each group, newer wins (spec §5.4).
        """
        examples = await self.list_examples(section_type=section_type)
        examples.sort(
            key=lambda e: (1 if e.from_published_issue else 0, e.created_at),
            reverse=True,
        )
        return [e.example_text for e in examples[:limit]]

    async def seed_from_file(self, seed_path: str | Path) -> int:
        """Idempotent JSON seed loader. Returns count of newly inserted rows."""
        path = Path(seed_path)
        if not path.exists():
            logger.warning("Voice seed file not found: %s", path)
            return 0
        data = json.loads(path.read_text())
        if not isinstance(data, list):
            raise ValueError("Voice seed file must be a JSON array")

        storage = get_storage()
        loaded = 0
        for entry in data:
            ex_id = entry.get("id")
            if not ex_id:
                continue
            if await storage.get(TABLE, ex_id) is not None:
                continue
            entry.setdefault("created_at", _now_iso())
            await storage.put(TABLE, ex_id, entry)
            loaded += 1
        return loaded


voice_service = VoiceService()
