"""Smoke tests for the LocalStorageBackend abstraction.

These verify the kv interface works against a real (temporary) SQLite file
and that file storage round-trips bytes through the filesystem.
"""

import tempfile
from datetime import datetime, timezone
from pathlib import Path

import pytest

from app.services.storage.local import LocalStorageBackend


@pytest.fixture
def backend(tmp_path: Path) -> LocalStorageBackend:
    return LocalStorageBackend(storage_root=tmp_path)


@pytest.mark.asyncio
async def test_kv_round_trip(backend: LocalStorageBackend) -> None:
    """Write a row, read it back, list it, then delete it."""
    now = datetime.now(timezone.utc).isoformat()
    pov = {
        "name": "New Item Evaluation Platform",
        "one_liner": "Agentic evaluation of new SKU submissions for retail buyers.",
        "problem_statement": "Buyers make subjective new-SKU calls.",
        "architecture": "POS, NiFi, Kafka, Iceberg, OpenSearch",
        "why_cloudera": "Hybrid data fabric for visual + tabular signals.",
        "target_accounts": ["Walmart", "Target", "Kroger"],
        "target_persona": "CPG merchandising, category management",
        "ae_hook": "Use when buyer team is drowning in supplier submissions.",
        "tags": ["agentic", "computer-vision", "merchandising"],
        "created_at": now,
        "updated_at": now,
    }

    await backend.put("pov_library", "pov-001", pov)

    fetched = await backend.get("pov_library", "pov-001")
    assert fetched is not None
    assert fetched["name"] == pov["name"]
    assert fetched["target_accounts"] == pov["target_accounts"]
    assert fetched["tags"] == pov["tags"]

    rows = await backend.list("pov_library")
    assert len(rows) == 1
    assert rows[0]["id"] == "pov-001"

    rows_prefix = await backend.list("pov_library", prefix="pov-")
    assert len(rows_prefix) == 1

    rows_miss = await backend.list("pov_library", prefix="zzz-")
    assert rows_miss == []

    await backend.delete("pov_library", "pov-001")
    assert await backend.get("pov_library", "pov-001") is None


@pytest.mark.asyncio
async def test_unknown_table_rejected(backend: LocalStorageBackend) -> None:
    with pytest.raises(ValueError):
        await backend.get("not_a_table", "x")


@pytest.mark.asyncio
async def test_file_round_trip(backend: LocalStorageBackend) -> None:
    payload = b"the retail read \x00\x01\x02"
    resolved = await backend.store_file("issues/2026-05/issue-001/issue-001.pdf", payload)
    assert resolved.endswith("issue-001.pdf")

    fetched = await backend.get_file("issues/2026-05/issue-001/issue-001.pdf")
    assert fetched == payload

    url = await backend.file_url("issues/2026-05/issue-001/issue-001.pdf")
    assert url == resolved


@pytest.mark.asyncio
async def test_file_path_traversal_blocked(backend: LocalStorageBackend) -> None:
    with pytest.raises(ValueError):
        await backend.store_file("../escape.txt", b"nope")
    with pytest.raises(ValueError):
        await backend.store_file("/etc/passwd", b"nope")
