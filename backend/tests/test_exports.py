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
from app.services.newsletter.exports import (
    _font_face_css,
    _inline_fonts_for_print,
    _trimmed_logo_uri,
    build_email_html,
    build_pdf,
    build_slack_text,
)
from app.services.newsletter.voice import VoiceService
from app.services.storage.local import LocalStorageBackend


def _chromium_available() -> bool:
    """True if Playwright can launch headless Chromium (the PDF render path)."""
    try:
        from playwright.async_api import async_playwright  # noqa: F401
    except Exception:
        return False
    import asyncio

    async def _probe() -> bool:
        from playwright.async_api import async_playwright

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(args=["--no-sandbox"])
            await browser.close()
        return True

    try:
        return asyncio.run(_probe())
    except Exception:
        return False


_requires_chromium = pytest.mark.skipif(
    not _chromium_available(), reason="headless Chromium unavailable for PDF render"
)


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


def test_font_face_css_embeds_both_brand_families() -> None:
    """The PDF @font-face block embeds the instanced Plus Jakarta Sans + JetBrains
    Mono weights as base64 — no network dependency at render time."""
    css = _font_face_css()
    assert css.count("@font-face") == 13  # 5 PJS + 5 PJS italic + 3 JBM
    assert "'Plus Jakarta Sans'" in css and "'JetBrains Mono'" in css
    assert "font-style:italic" in css
    assert "data:font/ttf;base64," in css


def test_inline_fonts_swaps_cdn_link_for_local_faces() -> None:
    """The print transform drops the Google Fonts CDN <link> and injects @font-face."""
    html = build_email_html(_issue())
    assert "fonts.googleapis.com/css2" in html  # email keeps the CDN link
    printed = _inline_fonts_for_print(html)
    assert "fonts.googleapis.com/css2" not in printed  # PDF render does not
    assert "@font-face" in printed and "data:font/ttf;base64," in printed


@_requires_chromium
def test_build_pdf_returns_pdf_bytes() -> None:
    data = build_pdf(_issue())
    assert isinstance(data, bytes)
    assert data[:5] == b"%PDF-"
    assert len(data) > 1000


@_requires_chromium
def test_build_pdf_embeds_brand_fonts_not_helvetica() -> None:
    """The rendered PDF embeds Plus Jakarta Sans + JetBrains Mono, not Helvetica/Times."""
    import fitz  # PyMuPDF, used only to introspect the output

    data = build_pdf(_issue(), hero_image=b"\x89PNG\r\n\x1a\nfake", hero_image_mime="image/png")
    doc = fitz.open(stream=data, filetype="pdf")
    fonts = {f[3] for pno in range(doc.page_count) for f in doc.get_page_fonts(pno)}
    assert any("JakartaSans" in name for name in fonts), fonts
    assert any("JetBrainsMono" in name for name in fonts), fonts
    assert not any(("Helvetica" in n or "Times" in n) for n in fonts), fonts


def test_build_email_html_has_inline_styles_and_sections() -> None:
    html = build_email_html(_issue())
    assert "style=" in html  # inline CSS on every element
    # Briefing masthead + section labels (the four-moves / editor's note slots are omitted).
    assert "The Retail Read" in html
    for label in ["What I&#39;m reading", "Use Case Spotlight", "Wins &amp; References", "On The Horizon"]:
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
    assert "On The Horizon" in html


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
    assert "On The Horizon" not in html
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


# ---------- Render fixes (paragraphs, spotlight layout, horizon list, CTA) ----------


def test_the_read_preserves_paragraph_breaks() -> None:
    """Blank-line-separated paragraphs in The Read each get their own <p>."""
    issue = _issue()
    issue.sections.the_read.content = (
        "First paragraph leads the issue.\n\n"
        "Second paragraph develops it.\n\n"
        "Third paragraph lands the point."
    )
    html = build_email_html(issue)
    # Drop cap floats the first letter of paragraph one; the two later paragraphs
    # become discrete <p> tags with top margin (visible separation).
    assert "Second paragraph develops it." in html
    assert "Third paragraph lands the point." in html
    assert html.count("margin:16px 0 0;") >= 2  # the two trailing paragraphs


def test_spotlight_image_is_full_width_above_body() -> None:
    """Spotlight stacks image (full column) over body — no narrow 270px column."""
    issue = _issue()
    html = build_email_html(
        issue, spotlight_image=b"\x89PNG\r\n\x1a\nfake", spotlight_image_mime="image/png"
    )
    assert "data:image/png;base64," in html
    assert 'max-width:552px' in html  # full content-column width, not 256px
    assert 'width="270"' not in html  # old side-by-side column is gone


def test_spotlight_body_preserves_paragraphs() -> None:
    issue = _issue()
    issue.sections.use_case_spotlight.content = "Para one of the spotlight.\n\nPara two of the spotlight."
    html = build_email_html(issue)
    assert "Para one of the spotlight." in html
    assert "Para two of the spotlight." in html


def test_horizon_renders_as_bulleted_list_not_columns() -> None:
    issue = _issue()
    html = build_email_html(issue)
    assert "On The Horizon" in html
    # No 3-up event columns; items render in a vertical bulleted list.
    assert 'width="33.33%"' not in html
    assert "rr-event-cell" not in html
    for item in ["Board session May 28.", "NRF Big Show January.", "Analytics Unite recap."]:
        assert item in html


def test_cta_copy_defaults_are_field_ae_oriented() -> None:
    html = build_email_html(_issue())
    assert "What account is this hitting? Send the name." in html
    assert "30-min walkthrough of any use case." in html
    # Old data-scientist-flavoured copy is gone.
    assert "Tell me where I am wrong." not in html
    assert "30 minutes, working session." not in html


def test_cta_copy_is_configurable() -> None:
    html = build_email_html(
        _issue(),
        reply_cta_heading="Ping ›",
        reply_cta_body="Custom reply line.",
        book_cta_heading="Meet ›",
        book_cta_body="Custom book line.",
    )
    assert "Ping ›" in html and "Custom reply line." in html
    assert "Meet ›" in html and "Custom book line." in html


def test_briefing_email_inlines_official_cloudera_logos() -> None:
    """Masthead + colophon both render inlined Cloudera wordmark PNGs."""
    html = build_email_html(_issue())  # no hero/spotlight → only the two logos are PNGs
    # Both placements carry an inlined wordmark image, not a text/dot fallback.
    assert html.count('alt="Cloudera"') >= 2  # masthead + colophon wordmarks
    assert "width:11px;height:11px;border-radius:50%" not in html  # masthead dot gone
    assert "width:10px;height:10px;border-radius:50%" not in html  # colophon dot gone
    assert html.count("data:image/png;base64,") >= 2
    # Colophon clutter is gone: no typed C icon, no typography credit, no footer row.
    assert 'height="14"' not in html
    assert "Set in Plus" not in html
    assert "Unsubscribe" not in html


def test_briefing_email_logo_falls_back_when_assets_missing(monkeypatch) -> None:
    """If the brand assets can't be read, text fallbacks return (render never breaks)."""
    import app.services.newsletter.exports as ex

    monkeypatch.setattr(ex, "_asset_bytes", lambda _name: None)
    html = build_email_html(_issue())
    # Masthead dot+text fallback reappears; colophon falls back to the CLOUDERA wordmark text.
    assert "width:11px;height:11px;border-radius:50%" in html
    assert "CLOUDERA" in html
    assert "data:image/png;base64," not in html  # no inlined logos


def test_inlined_wordmarks_are_downscaled_and_uniform() -> None:
    """Both wordmarks inline at a small, near-identical native width.

    The colophon source is ~5132px and the masthead ~688px; left at native size,
    an email client that drops the width attribute balloons the layout (the Gmail
    paste bug). Capping both keeps them small and makes the two placements match.
    """
    import base64
    import io

    from PIL import Image

    sizes = {}
    for fn in ("cloudera-logo.png", "Cloudera_logo_darkorange.png"):
        uri = _trimmed_logo_uri(fn)
        assert uri and uri.startswith("data:image/png;base64,")
        img = Image.open(io.BytesIO(base64.b64decode(uri.split(",", 1)[1])))
        sizes[fn] = img.width
        assert img.width <= 200, f"{fn} inlined at {img.width}px (should be capped)"
    # Masthead and colophon wordmarks render at the same width (no size disparity).
    assert abs(sizes["cloudera-logo.png"] - sizes["Cloudera_logo_darkorange.png"]) <= 2


def test_preheader_is_first_body_element_not_in_head() -> None:
    """The inbox preview text sits at the top of <body>, not inside <head>.

    A preheader stranded in <head> can be relocated to the visible top of the
    email by sanitizers (Gmail) — it must be the first body element instead.
    """
    issue = _issue()
    issue.sections.the_read.content = "Uber burned its entire 2026 AI budget by April. The rest follows."
    html = build_email_html(issue)
    head = html[: html.find("<body")]
    body = html[html.find("<body") :]
    assert "Uber burned its entire" not in head  # preheader not stranded in <head>
    assert "Uber burned its entire" in body
    # It appears before the masthead strip.
    assert body.find("Uber burned its entire") < body.find("TOP DARK STRIP")


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
