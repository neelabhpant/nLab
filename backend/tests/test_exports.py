"""Tests for Phase 6 exports + voice-corpus auto-growth.

Export builders are pure and tested directly. The mark_sent integration uses
an isolated LocalStorageBackend so PDF/HTML files land in a tmp dir and the
voice corpus harvest writes to a fresh table.
"""

from pathlib import Path

import pytest

from app.models.newsletter import (
    BulletSection,
    IssueDraftCreate,
    IssueSections,
    TheReadSection,
    UseCaseSpotlightSection,
    WhatsMovingItem,
    WhatsMovingSection,
)
from app.models.newsletter import SentIssue
from app.services import storage as storage_module
from app.services.newsletter import composer as composer_module
from app.services.newsletter import voice as voice_module
from app.services.newsletter.composer import ComposerService
from app.services.newsletter.exports import build_email_html, build_pdf, build_slack_text
from app.services.newsletter.voice import VoiceService
from app.services.storage.local import LocalStorageBackend


def _sections() -> IssueSections:
    return IssueSections(
        the_read=TheReadSection(content="Agentic AI demands clean data. Without it, retailers lose."),
        whats_moving=WhatsMovingSection(
            items=[
                WhatsMovingItem(line="Walmart expanded its CV pilot to 500 stores."),
                WhatsMovingItem(line="Kroger 84.51 added Snowflake last month."),
                WhatsMovingItem(line="Target shipped personalisation v2."),
                WhatsMovingItem(line="Costco trialled agentic restocking."),
            ]
        ),
        use_case_spotlight=UseCaseSpotlightSection(
            pov_id=None,
            content="New Item Evaluation is the platform any CPG buyer wishes they had three years ago.",
            tailored_for_account="Walmart",
        ),
        wins=BulletSection(items=["Walmart CDP expansion.", "CGT data award.", "Kroger renewal."]),
        horizon=BulletSection(items=["Board session May 28.", "NRF Big Show January.", "Analytics Unite recap."]),
    )


def _issue() -> SentIssue:
    return SentIssue(
        id="issue-test",
        issue_number=1,
        slug="issue-001",
        title="Agentic AI demands clean data",
        sections=_sections(),
        footer_cta="Reply with the account you want spotlighted next.",
        pdf_path=None,
        html_path=None,
        sent_at="2026-05-22T12:00:00+00:00",
        recipient_count=24,
    )


# ---------- Pure builders ----------


def test_build_pdf_returns_pdf_bytes() -> None:
    data = build_pdf(_issue())
    assert isinstance(data, bytes)
    assert data[:5] == b"%PDF-"
    assert len(data) > 1000


def test_build_email_html_has_inline_styles_and_sections() -> None:
    html = build_email_html(_issue())
    assert "style=" in html  # inline CSS
    assert "<style>" not in html  # no <style> blocks (email clients drop them)
    for heading in ["The Read", "What's Moving", "Use Case Spotlight", "Wins &amp; References", "On the Horizon"]:
        assert heading in html
    assert "Issue 001" in html
    assert "#F96302" in html  # Cloudera orange
    assert "Tailored for Walmart" in html


def test_build_slack_text_uses_markdown() -> None:
    text = build_slack_text(_issue())
    assert "*The Retail Read — Issue 001*" in text
    assert "*The Read*" in text
    assert "*What's Moving*" in text
    assert "• Walmart expanded its CV pilot to 500 stores." in text
    assert "!" not in text.split("\n")[0]  # no exclamation in the header line


# ---------- mark_sent integration ----------


@pytest.fixture
def isolated_storage(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> LocalStorageBackend:
    backend = LocalStorageBackend(storage_root=tmp_path)
    monkeypatch.setattr(storage_module, "_backend", backend, raising=False)
    monkeypatch.setattr(storage_module, "get_storage", lambda: backend)
    monkeypatch.setattr(composer_module, "get_storage", lambda: backend)
    monkeypatch.setattr(voice_module, "get_storage", lambda: backend)
    return backend


@pytest.mark.asyncio
async def test_mark_sent_generates_exports(isolated_storage: LocalStorageBackend) -> None:
    service = ComposerService()
    draft = await service.create_draft(IssueDraftCreate(sections=_sections(), footer_cta="cta"))
    issue = await service.mark_sent(draft.id, recipient_count=10)

    assert issue is not None
    assert issue.pdf_path == "issues/2026-05/issue-001/issue-001.pdf"
    assert issue.html_path == "issues/2026-05/issue-001/issue-001.html"

    # Files actually exist on disk and round-trip.
    pdf_bytes = await isolated_storage.get_file(issue.pdf_path)
    assert pdf_bytes[:5] == b"%PDF-"
    html_bytes = await isolated_storage.get_file(issue.html_path)
    assert b"THE RETAIL READ" in html_bytes


@pytest.mark.asyncio
async def test_mark_sent_harvests_voice_corpus(isolated_storage: LocalStorageBackend) -> None:
    composer = ComposerService()
    voice = VoiceService()

    before = await voice.list_examples()
    assert before == []

    draft = await composer.create_draft(IssueDraftCreate(sections=_sections(), footer_cta="cta"))
    await composer.mark_sent(draft.id)

    after = await voice.list_examples()
    # All 5 sections have content, so 5 published examples written.
    assert len(after) == 5
    assert all(e.from_published_issue for e in after)
    assert {e.section_type for e in after} == {
        "the_read",
        "whats_moving",
        "use_case_spotlight",
        "wins",
        "horizon",
    }
    assert all(e.source == "Issue 001" for e in after)


@pytest.mark.asyncio
async def test_published_examples_preferred_in_few_shot(isolated_storage: LocalStorageBackend) -> None:
    from app.models.voice import VoiceExampleCreate

    voice = VoiceService()
    # A seed (non-published) example.
    await voice.add_example(
        VoiceExampleCreate(section_type="the_read", example_text="SEED EXAMPLE")
    )
    # A published example added later.
    await voice.add_published_example("the_read", "PUBLISHED EXAMPLE", source="Issue 001")

    few = await voice.get_few_shot_examples("the_read", limit=5)
    # Published wins the top slot.
    assert few[0] == "PUBLISHED EXAMPLE"
    assert "SEED EXAMPLE" in few


@pytest.mark.asyncio
async def test_empty_sections_not_harvested(isolated_storage: LocalStorageBackend) -> None:
    composer = ComposerService()
    voice = VoiceService()

    # Only The Read has content.
    sections = IssueSections(the_read=TheReadSection(content="Only this section."))
    draft = await composer.create_draft(IssueDraftCreate(sections=sections))
    await composer.mark_sent(draft.id)

    after = await voice.list_examples()
    assert len(after) == 1
    assert after[0].section_type == "the_read"
