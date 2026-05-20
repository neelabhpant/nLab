"""Unit tests for POVLibraryService.

Each test gets a fresh LocalStorageBackend rooted at a tmp_path. We swap the
service module's storage factory so the service operates on the isolated
backend rather than the global instance.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

import pytest

from app.models.pov import POVCreate, POVUpdate
from app.services import pov_library as pov_library_module
from app.services import storage as storage_module
from app.services.pov_library import POVLibraryService
from app.services.storage.local import LocalStorageBackend


@pytest.fixture
def isolated_storage(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> LocalStorageBackend:
    """Replace the singleton storage backend with one rooted at tmp_path."""
    backend = LocalStorageBackend(storage_root=tmp_path)
    monkeypatch.setattr(storage_module, "_backend", backend, raising=False)
    monkeypatch.setattr(storage_module, "get_storage", lambda: backend)
    # The service module captured `get_storage` at import time — patch the module attr too.
    monkeypatch.setattr(pov_library_module, "get_storage", lambda: backend)
    return backend


@pytest.fixture
def service(isolated_storage: LocalStorageBackend) -> POVLibraryService:
    return POVLibraryService()


def _sample(name: str = "NIE", tags: list[str] | None = None) -> POVCreate:
    return POVCreate(
        name=name,
        one_liner="One-liner.",
        problem_statement="Buyers make subjective calls.",
        architecture="POS, NiFi, Kafka, Iceberg",
        why_cloudera="Governed multimodal stack.",
        target_accounts=["Walmart", "Target"],
        target_persona="Category management",
        ae_hook="Use when buyer is drowning in submissions.",
        tags=tags or ["multimodal", "merchandising"],
    )


@pytest.mark.asyncio
async def test_create_get_roundtrip(service: POVLibraryService) -> None:
    created = await service.create_pov(_sample())
    assert created.id.startswith("pov-")
    assert created.created_at == created.updated_at

    fetched = await service.get_pov(created.id)
    assert fetched is not None
    assert fetched.name == "NIE"
    assert fetched.target_accounts == ["Walmart", "Target"]
    assert fetched.tags == ["multimodal", "merchandising"]


@pytest.mark.asyncio
async def test_list_returns_all(service: POVLibraryService) -> None:
    await service.create_pov(_sample(name="A"))
    await service.create_pov(_sample(name="B"))
    rows = await service.list_povs()
    names = {p.name for p in rows}
    assert names == {"A", "B"}


@pytest.mark.asyncio
async def test_list_filter_by_tag_and_account(service: POVLibraryService) -> None:
    await service.create_pov(_sample(name="A", tags=["cpg", "agentic"]))
    await service.create_pov(_sample(name="B", tags=["edge-ai"]))
    await service.create_pov(_sample(name="C", tags=["cpg", "vector-search"]))

    cpg = await service.list_povs(tag="cpg")
    assert {p.name for p in cpg} == {"A", "C"}

    walmart = await service.list_povs(account="Walmart")
    assert {p.name for p in walmart} == {"A", "B", "C"}

    none = await service.list_povs(tag="not-a-tag")
    assert none == []


@pytest.mark.asyncio
async def test_update_changes_fields_and_timestamp(service: POVLibraryService) -> None:
    created = await service.create_pov(_sample())
    before = created.updated_at

    # Ensure the clock ticks forward — ISO timestamps include microseconds.
    import asyncio
    await asyncio.sleep(0.01)

    updated = await service.update_pov(
        created.id,
        POVUpdate(name="NIE v2", tags=["new-tag"]),
    )
    assert updated is not None
    assert updated.name == "NIE v2"
    assert updated.tags == ["new-tag"]
    # Unchanged fields preserved.
    assert updated.architecture == created.architecture
    assert updated.updated_at != before


@pytest.mark.asyncio
async def test_update_missing_returns_none(service: POVLibraryService) -> None:
    result = await service.update_pov("pov-missing", POVUpdate(name="x"))
    assert result is None


@pytest.mark.asyncio
async def test_delete_removes_record(service: POVLibraryService) -> None:
    created = await service.create_pov(_sample())
    assert await service.delete_pov(created.id) is True
    assert await service.get_pov(created.id) is None
    assert await service.delete_pov(created.id) is False


@pytest.mark.asyncio
async def test_seed_from_file_idempotent(service: POVLibraryService, tmp_path: Path) -> None:
    seed_path = tmp_path / "seed.json"
    now = datetime.now(timezone.utc).isoformat()
    seed_path.write_text(json.dumps([
        {
            "id": "pov-fixture-1",
            "name": "Fixture POV",
            "one_liner": "x",
            "problem_statement": "y",
            "architecture": "z",
            "why_cloudera": "w",
            "target_accounts": ["Acme"],
            "target_persona": "Buyer",
            "ae_hook": "use this",
            "tags": ["fixture"],
            "created_at": now,
            "updated_at": now,
        }
    ]))

    first = await service.seed_from_file(seed_path)
    assert first == 1
    second = await service.seed_from_file(seed_path)
    assert second == 0  # idempotent — nothing new loaded

    rows = await service.list_povs()
    assert len(rows) == 1
    assert rows[0].id == "pov-fixture-1"


@pytest.mark.asyncio
async def test_upload_screenshot_persists_path(
    service: POVLibraryService,
    isolated_storage: LocalStorageBackend,
) -> None:
    created = await service.create_pov(_sample())
    rel = await service.upload_screenshot(created.id, b"\x89PNG\r\n", "demo.png")
    assert rel == f"pov_screenshots/{created.id}.png"

    refreshed = await service.get_pov(created.id)
    assert refreshed is not None
    assert refreshed.demo_screenshot_path == rel

    # Resolves to a real file on disk.
    resolved = await isolated_storage.file_url(rel)
    assert Path(resolved).exists()


@pytest.mark.asyncio
async def test_upload_rejects_unknown_extension(service: POVLibraryService) -> None:
    created = await service.create_pov(_sample())
    with pytest.raises(ValueError):
        await service.upload_screenshot(created.id, b"x", "demo.exe")
