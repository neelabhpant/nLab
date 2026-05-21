"""Unit tests for ComposerService.

Each test gets a fresh LocalStorageBackend rooted at tmp_path. We patch the
composer module's storage factory to point at the isolated backend.
"""

import asyncio
from pathlib import Path

import pytest

from app.models.newsletter import (
    BulletSection,
    IssueDraftCreate,
    IssueDraftUpdate,
    IssueSections,
    TheReadSection,
    WhatsMovingItem,
    WhatsMovingSection,
)
from app.services import storage as storage_module
from app.services.newsletter import composer as composer_module
from app.services.newsletter.composer import ComposerService
from app.services.storage.local import LocalStorageBackend


@pytest.fixture
def isolated_storage(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> LocalStorageBackend:
    backend = LocalStorageBackend(storage_root=tmp_path)
    monkeypatch.setattr(storage_module, "_backend", backend, raising=False)
    monkeypatch.setattr(storage_module, "get_storage", lambda: backend)
    monkeypatch.setattr(composer_module, "get_storage", lambda: backend)
    return backend


@pytest.fixture
def service(isolated_storage: LocalStorageBackend) -> ComposerService:
    return ComposerService()


def _filled_sections(read: str = "Agentic AI demands clean data. Without it, retailers lose.") -> IssueSections:
    return IssueSections(
        the_read=TheReadSection(content=read),
        whats_moving=WhatsMovingSection(
            items=[
                WhatsMovingItem(line="Walmart expanded its CV pilot."),
                WhatsMovingItem(line="Kroger 84.51 added Snowflake."),
                WhatsMovingItem(line="Target launched personalisation v2."),
                WhatsMovingItem(line="Costco trialled agentic restocking."),
            ]
        ),
        wins=BulletSection(items=["Walmart CDP expansion.", "CGT data award.", "Kroger renewal."]),
        horizon=BulletSection(items=["Board session May 28.", "NRF Big Show January.", "Analytics Unite recap."]),
    )


# ---------- CRUD ----------


@pytest.mark.asyncio
async def test_create_get_roundtrip(service: ComposerService) -> None:
    created = await service.create_draft(IssueDraftCreate(sections=_filled_sections(), footer_cta="Reply with feedback."))
    assert created.id.startswith("draft-")
    assert created.status == "draft"
    assert created.created_at == created.updated_at

    fetched = await service.get_draft(created.id)
    assert fetched is not None
    assert fetched.sections.the_read.content.startswith("Agentic AI demands clean data.")
    assert len(fetched.sections.whats_moving.items) == 4
    assert fetched.footer_cta == "Reply with feedback."


@pytest.mark.asyncio
async def test_update_preserves_unspecified_fields(service: ComposerService) -> None:
    created = await service.create_draft(IssueDraftCreate(sections=_filled_sections(), footer_cta="v1"))
    before = created.updated_at
    await asyncio.sleep(0.01)

    updated = await service.update_draft(
        created.id,
        IssueDraftUpdate(footer_cta="v2"),
    )
    assert updated is not None
    # Footer changed, sections preserved
    assert updated.footer_cta == "v2"
    assert len(updated.sections.whats_moving.items) == 4
    assert updated.updated_at != before


@pytest.mark.asyncio
async def test_list_drafts_newest_first(service: ComposerService) -> None:
    a = await service.create_draft(IssueDraftCreate(footer_cta="A"))
    await asyncio.sleep(0.01)
    b = await service.create_draft(IssueDraftCreate(footer_cta="B"))
    await asyncio.sleep(0.01)
    c = await service.create_draft(IssueDraftCreate(footer_cta="C"))

    rows = await service.list_drafts()
    assert [r.id for r in rows] == [c.id, b.id, a.id]


@pytest.mark.asyncio
async def test_delete_draft(service: ComposerService) -> None:
    created = await service.create_draft(IssueDraftCreate())
    assert await service.delete_draft(created.id) is True
    assert await service.get_draft(created.id) is None
    assert await service.delete_draft(created.id) is False


@pytest.mark.asyncio
async def test_update_missing_returns_none(service: ComposerService) -> None:
    assert await service.update_draft("draft-missing", IssueDraftUpdate(footer_cta="x")) is None


# ---------- Send flow ----------


@pytest.mark.asyncio
async def test_mark_sent_moves_record(service: ComposerService) -> None:
    draft = await service.create_draft(IssueDraftCreate(sections=_filled_sections(), footer_cta="cta"))
    issue = await service.mark_sent(draft.id, recipient_count=12)
    assert issue is not None
    assert issue.issue_number == 1
    assert issue.slug == "issue-001"
    assert issue.recipient_count == 12
    assert issue.title.startswith("Agentic AI demands clean data")

    # Draft is gone.
    assert await service.get_draft(draft.id) is None
    # Issue is present.
    assert await service.get_issue(issue.id) is not None

    drafts = await service.list_drafts()
    assert drafts == []
    issues = await service.list_issues()
    assert len(issues) == 1


@pytest.mark.asyncio
async def test_mark_sent_assigns_sequential_issue_numbers(service: ComposerService) -> None:
    first = await service.mark_sent(
        (await service.create_draft(IssueDraftCreate(sections=_filled_sections("First.")))).id
    )
    second = await service.mark_sent(
        (await service.create_draft(IssueDraftCreate(sections=_filled_sections("Second.")))).id
    )
    third = await service.mark_sent(
        (await service.create_draft(IssueDraftCreate(sections=_filled_sections("Third.")))).id
    )

    assert first.issue_number == 1
    assert second.issue_number == 2
    assert third.issue_number == 3
    assert first.slug == "issue-001"
    assert third.slug == "issue-003"


@pytest.mark.asyncio
async def test_mark_sent_missing_returns_none(service: ComposerService) -> None:
    assert await service.mark_sent("draft-missing") is None


# ---------- _derive_title ----------


@pytest.mark.parametrize(
    "the_read,expected",
    [
        ("", "Untitled Issue"),
        ("Short take.", "Short take"),
        ("Short take. More follows.", "Short take"),
        # No period within first 80 chars → 60-char prefix + ellipsis.
        ("A" * 100, "A" * 60 + "..."),
        # Period sits past character 80 → first 60-char prefix (trailing space stripped before ellipsis).
        ("Word " * 30 + ".", ("Word " * 12).rstrip() + "..."),
        # Short single line with no period — return the whole thing.
        ("No period here", "No period here"),
    ],
)
def test_derive_title(the_read: str, expected: str) -> None:
    service = ComposerService()
    sections = IssueSections(the_read=TheReadSection(content=the_read))
    assert service._derive_title(sections) == expected
