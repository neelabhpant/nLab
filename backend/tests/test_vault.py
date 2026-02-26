"""Tests for vault storage and router endpoints."""

import os
import tempfile
import uuid

import pytest
import pytest_asyncio

from app.services.vault_storage import VaultStorage, VAULT_DATA_PATH, DB_PATH, FILES_DIR


@pytest_asyncio.fixture
async def storage(tmp_path, monkeypatch):
    """Create a VaultStorage backed by a temporary directory."""
    import app.services.vault_storage as vs

    monkeypatch.setattr(vs, "VAULT_DATA_PATH", tmp_path)
    monkeypatch.setattr(vs, "DB_PATH", tmp_path / "vault.db")
    monkeypatch.setattr(vs, "FILES_DIR", tmp_path / "files")

    s = VaultStorage()
    await s.init_db()
    return s


@pytest.mark.asyncio
async def test_save_and_get_document(storage: VaultStorage) -> None:
    doc_id = await storage.save_document("test.pdf", b"fake pdf content", "user@example.com")
    assert doc_id

    doc = await storage.get_document(doc_id)
    assert doc is not None
    assert doc["filename"] == "test.pdf"
    assert doc["file_type"] == "pdf"
    assert doc["user_email"] == "user@example.com"
    assert doc["status"] == "pending"


@pytest.mark.asyncio
async def test_list_documents(storage: VaultStorage) -> None:
    await storage.save_document("a.txt", b"hello", "user@example.com")
    await storage.save_document("b.csv", b"col1,col2", "user@example.com")
    await storage.save_document("c.pdf", b"pdf", "other@example.com")

    docs = await storage.list_documents(user_email="user@example.com")
    assert len(docs) == 2

    docs_other = await storage.list_documents(user_email="other@example.com")
    assert len(docs_other) == 1


@pytest.mark.asyncio
async def test_update_document(storage: VaultStorage) -> None:
    doc_id = await storage.save_document("test.txt", b"data", "user@example.com")
    await storage.update_document(doc_id, {
        "status": "completed",
        "title": "My Document",
        "summary": "A test document.",
        "doc_type": "notes",
    })

    doc = await storage.get_document(doc_id)
    assert doc["status"] == "completed"
    assert doc["title"] == "My Document"
    assert doc["doc_type"] == "notes"


@pytest.mark.asyncio
async def test_delete_document(storage: VaultStorage) -> None:
    doc_id = await storage.save_document("del.txt", b"bye", "user@example.com")
    doc = await storage.get_document(doc_id)
    assert doc is not None

    await storage.delete_document(doc_id)
    doc = await storage.get_document(doc_id)
    assert doc is None


@pytest.mark.asyncio
async def test_get_stats(storage: VaultStorage) -> None:
    await storage.save_document("a.pdf", b"x" * 100, "user@example.com")
    await storage.save_document("b.pdf", b"y" * 200, "user@example.com")

    await storage.update_document(
        (await storage.list_documents("user@example.com"))[0]["id"],
        {"doc_type": "report"},
    )

    stats = await storage.get_stats("user@example.com")
    assert stats["total"] == 2
    assert stats["total_size"] == 300


@pytest.mark.asyncio
async def test_search_text(storage: VaultStorage) -> None:
    doc_id = await storage.save_document("finance.txt", b"data", "user@example.com")
    await storage.update_document(doc_id, {
        "title": "Q4 Financial Report",
        "summary": "Revenue grew 15% year over year.",
        "raw_text": "Full quarterly financial report with detailed revenue analysis.",
    })

    results = await storage.search_text("user@example.com", "revenue")
    assert len(results) >= 1
    assert results[0]["title"] == "Q4 Financial Report"

    no_results = await storage.search_text("user@example.com", "nonexistentxyz")
    assert len(no_results) == 0


@pytest.mark.asyncio
async def test_update_ignores_disallowed_fields(storage: VaultStorage) -> None:
    doc_id = await storage.save_document("test.txt", b"data", "user@example.com")
    await storage.update_document(doc_id, {
        "user_email": "hacker@evil.com",
        "id": "fake-id",
        "file_path": "/etc/passwd",
    })

    doc = await storage.get_document(doc_id)
    assert doc["user_email"] == "user@example.com"
    assert doc["id"] == doc_id
