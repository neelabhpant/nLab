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
    assert "style=" in html  # inline CSS on every element
    # Briefing masthead + section labels (the four-moves / editor's note slots are omitted).
    assert "The Retail Read" in html
    for label in ["What I&#39;m reading", "Use Case Spotlight", "Wins &amp; References", "Where I&#39;ll be"]:
        assert label in html
    # Vol/No/Date strip uses zero-padded numbers, not "Issue 001".
    assert "No.&nbsp;01" in html
    assert "#F96302" in html  # Cloudera orange
    assert "Walmart" in html  # tailored-for account renders in the spotlight label row


# ---------- Phase 8 auto-derivation ----------


def test_derive_subhead_first_sentence() -> None:
    from app.services.newsletter.exports import derive_subhead

    assert derive_subhead("Agentic AI demands clean data. Without it, retailers lose.") == (
        "Agentic AI demands clean data."
    )
    # No terminator → whole content (truncated).
    assert derive_subhead("a one liner with no period").startswith("a one liner")
    assert derive_subhead("") == ""


def test_derive_pull_quote_prefers_last_paragraph() -> None:
    from app.services.newsletter.exports import derive_pull_quote

    text = (
        "First paragraph here. Another short one.\n\n"
        "The retailers winning at AI are the ones who decided early which decisions a machine "
        "is allowed to make alone."
    )
    # Last paragraph's single sentence (< 35 words) wins.
    assert derive_pull_quote(text).startswith("The retailers winning at AI")


def test_derive_pull_quote_under_35_word_constraint() -> None:
    from app.services.newsletter.exports import derive_pull_quote

    long_sentence = " ".join(["word"] * 50) + "."  # 50 words, disqualified
    short_sentence = "A crisp pull quote sentence."
    # Both in the same single paragraph; only the short one qualifies.
    assert derive_pull_quote(f"{long_sentence} {short_sentence}") == short_sentence


def test_derive_pull_quote_none_when_no_qualifier() -> None:
    from app.services.newsletter.exports import derive_pull_quote

    only_long = " ".join(["word"] * 40) + "."  # 40 words, no boundary, disqualified
    assert derive_pull_quote(only_long) is None
    assert derive_pull_quote("") is None


def test_derive_volume() -> None:
    from app.services.newsletter.exports import derive_volume

    assert derive_volume("2026-06-09") == 1  # 2026 → 1
    assert derive_volume("2027-01-01") == 2
    assert derive_volume("2025-01-01") == 1  # floored at 1
    assert derive_volume(None) >= 1  # falls back to today, never below 1
    assert derive_volume("not-a-date") >= 1


def test_headline_with_em_wraps_last_word() -> None:
    from app.services.newsletter.exports import headline_with_em

    out = headline_with_em("The AI cost crisis hits retail next")
    assert out.startswith("The AI cost crisis hits retail ")
    assert out.endswith("<em style=\"font-style:italic;font-weight:500;\">next</em>")
    # Single word still gets wrapped.
    assert headline_with_em("Next") == '<em style="font-style:italic;font-weight:500;">Next</em>'
    assert headline_with_em("") == ""


# ---------- Phase 8 Briefing email render ----------


def test_briefing_email_uses_plus_jakarta_sans_no_newsreader() -> None:
    html = build_email_html(_issue())
    assert "Plus Jakarta Sans" in html
    assert "newsreader" not in html.lower()  # serif dropped entirely


def test_briefing_email_has_kicker_headline_em_and_sections() -> None:
    issue = _issue()
    issue.kicker = "THE COST WALL"
    html = build_email_html(issue)
    assert "THE COST WALL" in html  # kicker, uppercased mono
    assert "<em " in html  # headline last-word emphasis
    # All five present sections render their Briefing labels.
    assert "What I&#39;m reading" in html
    assert "Use Case Spotlight" in html
    assert "Wins &amp; References" in html
    assert "Where I&#39;ll be" in html


def test_briefing_email_kicker_defaults_to_feature() -> None:
    issue = _issue()
    issue.kicker = None
    html = build_email_html(issue)
    assert "FEATURE" in html


def test_briefing_email_collapses_hero_when_absent() -> None:
    html = build_email_html(_issue())  # no hero image
    assert "<!-- ── 05 · HERO IMAGE" not in html
    assert "data:image" not in html or "FIG &middot;" not in html


def test_briefing_email_embeds_hero_when_present() -> None:
    issue = _issue()
    issue.hero_caption = "Inference cost curve"
    html = build_email_html(issue, hero_image=b"\x89PNG\r\n\x1a\nfake", hero_image_mime="image/png")
    assert "data:image/png;base64," in html
    assert "FIG &middot;" in html
    assert "Inference cost curve" in html


def test_briefing_email_omits_pull_quote_when_none() -> None:
    from app.models.newsletter import SentIssue as _SI

    # The Read is a single 40-word sentence with no boundary → no pull quote.
    sections = _sections()
    sections.the_read.content = " ".join(["word"] * 40) + "."
    issue = _SI(
        id="x",
        issue_number=3,
        slug="issue-003",
        title="Title here",
        sections=sections,
        footer_cta="",
        sent_at="2026-06-09T12:00:00+00:00",
    )
    html = build_email_html(issue)
    assert "── 09 · PULL QUOTE" not in html


def test_briefing_email_omits_empty_sections_and_toc_entries() -> None:
    from app.models.newsletter import IssueSections, SentIssue as _SI, TheReadSection

    issue = _SI(
        id="x",
        issue_number=4,
        slug="issue-004",
        title="Only the read",
        sections=IssueSections(the_read=TheReadSection(content="Only this section ships.")),
        footer_cta="",
        sent_at="2026-06-09T12:00:00+00:00",
    )
    html = build_email_html(issue)
    # Empty sections collapse — their labels never appear.
    assert "Use Case Spotlight" not in html
    assert "Where I&#39;ll be" not in html
    assert "What I&#39;m reading" not in html


def test_briefing_email_has_no_model_metadata() -> None:
    html = build_email_html(_issue()).lower()
    for token in ("sonnet", "opus", "haiku", "claude", "newsreader"):
        assert token not in html


def test_briefing_email_uses_booking_url() -> None:
    html = build_email_html(_issue(), booking_url="https://cal.example.com/neelabh/30")
    assert "https://cal.example.com/neelabh/30" in html
    # Default is "#".
    assert 'href="#"' in build_email_html(_issue())


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
    assert b"The Retail Read" in html_bytes
    assert b"Plus Jakarta Sans" in html_bytes


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
