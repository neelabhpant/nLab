"""Export builders for The Retail Read — PDF, email HTML, Slack text.

Three pure functions that turn a SentIssue into a distribution artifact.
- build_pdf: Cloudera-branded archive PDF (PyMuPDF).
- build_email_html: single-column inline-CSS HTML for paste-into-Outlook.
- build_slack_text: plain text with Slack markdown.

See NEWSLETTER_COMPOSER_SPEC.md §8. The PDF helpers mirror the proven
approach in services/retail_newsletter.py but are re-implemented locally
so this module has no coupling to that file's private helpers.
"""

from __future__ import annotations

import base64
import html as html_lib
import io
import re
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import fitz
from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.models.newsletter import IssueSections, SentIssue

# ---------- Briefing palette (design-b-briefing/handoff/tokens.css) ----------

# Cream paper + brown-black ink. The Briefing is a warm editorial surface,
# not the old navy/slate dashboard scheme.
PAPER = (246, 241, 232)       # #f6f1e8
PAPER_EDGE = (236, 230, 216)  # #ece6d8
INK = (21, 17, 13)            # #15110d
INK_SOFT = (90, 79, 67)       # #5a4f43
RULE_FAINT = (198, 187, 168)  # #c6bba8
CLOUDERA_ORANGE = (249, 99, 2)  # #F96302
WHITE = (255, 255, 255)

PAPER_HEX = "#f6f1e8"
INK_HEX = "#15110d"
INK_SOFT_HEX = "#5a4f43"
ORANGE_HEX = "#F96302"

AUTHOR_NAME = "Neelabh Pant"
AUTHOR_TITLE = "Director, Global AI Industry Solutions, Retail"
AUTHOR_COMPANY = "Cloudera"
AUTHOR_CONTACT = "npant@cloudera.com"

# Jinja2 environment for the Briefing email template. Autoescape on for HTML —
# we use `|safe` deliberately only for the headline (where we inject <em>).
_TEMPLATE_DIR = Path(__file__).resolve().parent / "templates"
_jinja_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATE_DIR)),
    autoescape=select_autoescape(["html", "j2", "html.j2"]),
)

# Repo-root brand assets (.../nLab/assets/logo). Resolved from this file so it
# works regardless of the process working directory.
_ASSET_DIR = Path(__file__).resolve().parents[4] / "assets" / "logo"


def _asset_bytes(filename: str) -> Optional[bytes]:
    """Read a brand asset's raw bytes, or None if it isn't where we expect.

    A missing asset must never break a render — the template falls back to the
    inline text+dot wordmark when the data URI is None.
    """
    try:
        return (_ASSET_DIR / filename).read_bytes()
    except OSError:
        return None


def _trimmed_logo_uri(filename: str) -> Optional[str]:
    """Base64 data URI for an orange-on-transparent Cloudera wordmark, trimmed
    to its content bounding box.

    Trimming removes any transparent padding so a width-constrained render (~100px
    wide) produces a crisp wordmark with no empty-box artifacts — used for both
    the masthead (dark strip) and the colophon (cream). Only empty margins are
    removed; the wordmark pixels and colors are untouched. Falls back to the raw
    bytes if Pillow is unavailable.
    """
    data = _asset_bytes(filename)
    if not data:
        return None
    try:
        from PIL import Image

        img = Image.open(io.BytesIO(data)).convert("RGBA")
        box = img.getbbox()
        if box:
            img = img.crop(box)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        data = buf.getvalue()
    except Exception:  # noqa: BLE001 — trimming is best-effort; raw bytes still render
        pass
    return _data_uri(data, "image/png")

SECTION_TITLES: list[tuple[str, str]] = [
    ("the_read", "The Read"),
    ("whats_moving", "What's Moving"),
    ("use_case_spotlight", "Use Case Spotlight"),
    ("wins", "Wins & References"),
    ("horizon", "On the Horizon"),
]


def slugify(text: str, fallback: str = "issue") -> str:
    """Filename-safe slug from a title. e.g. 'The AI cost crisis.' -> 'the-ai-cost-crisis'."""
    s = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")
    return s or fallback


def _format_date(iso: str) -> str:
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).strftime("%B %-d, %Y")
    except (ValueError, AttributeError):
        return iso


# ---------- Section text extraction (shared shape) ----------


def _bullets(items: list[str]) -> list[str]:
    return [i.strip() for i in items if i and i.strip()]


def _paragraphs(text: str) -> list[str]:
    """Split body text into paragraphs on blank lines.

    A blank line (one or more newlines surrounded by optional whitespace) starts
    a new paragraph; single soft-wrap newlines inside a paragraph collapse to a
    space so each paragraph renders as one continuous <p>.
    """
    stripped = (text or "").strip()
    if not stripped:
        return []
    blocks = re.split(r"\n\s*\n", stripped)
    return [re.sub(r"\s*\n\s*", " ", b).strip() for b in blocks if b.strip()]


def _whats_moving_lines(sections: IssueSections) -> list[str]:
    return [i.line.strip() for i in sections.whats_moving.items if i.line and i.line.strip()]


# ---------- Auto-derivation (Briefing slots) ----------

# A sentence boundary: a period/question/exclamation followed by whitespace.
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")


def derive_subhead(the_read: str) -> str:
    """First sentence of The Read. Stops at the first terminator + whitespace.

    Falls back to the whole content (truncated) when there is no clear boundary.
    """
    text = (the_read or "").strip()
    if not text:
        return ""
    parts = _SENTENCE_SPLIT.split(text, maxsplit=1)
    first = parts[0].strip()
    if first:
        return first
    return text[:200].strip()


def _split_sentences(text: str) -> list[str]:
    return [s.strip() for s in _SENTENCE_SPLIT.split((text or "").strip()) if s.strip()]


def _longest_under_35(sentences: list[str]) -> Optional[str]:
    """Longest sentence with fewer than 35 whitespace-delimited words, else None."""
    qualifying = [s for s in sentences if len(s.split()) < 35]
    if not qualifying:
        return None
    return max(qualifying, key=lambda s: len(s.split()))


def derive_pull_quote(the_read: str) -> Optional[str]:
    """Pull quote = longest <35-word sentence in the LAST paragraph; then any
    paragraph; else None. Quote marks are added by the template.
    """
    text = (the_read or "").strip()
    if not text:
        return None
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    if not paragraphs:
        return None
    last = _longest_under_35(_split_sentences(paragraphs[-1]))
    if last:
        return last
    return _longest_under_35(_split_sentences(text))


def derive_volume(ship_date: Optional[str]) -> int:
    """Volume = year(ship_date or today) − 2025, floored at 1. 2026 → 1."""
    year: Optional[int] = None
    if ship_date:
        try:
            year = datetime.fromisoformat(ship_date.replace("Z", "+00:00")).year
        except (ValueError, AttributeError):
            year = None
    if year is None:
        year = datetime.now(timezone.utc).year
    return max(1, year - 2025)


_LAST_WORD = re.compile(r"^(.*?)(\S+)$", re.DOTALL)


def headline_with_em(title: str) -> str:
    """Wrap the last whitespace-delimited word of the title in an italic <em>.

    Both halves are HTML-escaped; the <em> markup is the only injected HTML, so
    the result is safe to pass through `|safe` in the template.
    """
    t = (title or "").strip()
    if not t:
        return ""
    words = t.split()
    if len(words) == 1:
        return (
            '<em style="font-style:italic;font-weight:500;">'
            f"{html_lib.escape(words[0], quote=False)}</em>"
        )
    head = " ".join(words[:-1])
    last = words[-1]
    return (
        f"{html_lib.escape(head, quote=False)} "
        '<em style="font-style:italic;font-weight:500;">'
        f"{html_lib.escape(last, quote=False)}</em>"
    )


# TOC: hardcoded label + page-ref mapping, keyed by section. Only non-empty
# sections appear (caller filters).
_TOC_MAP: list[tuple[str, str, str]] = [
    ("the_read", "The Read", "A1"),
    ("whats_moving", "What's Moving", "A2"),
    ("use_case_spotlight", "Use Case Spotlight", "B1"),
    ("wins", "Wins & References", "B2"),
    ("horizon", "On The Horizon", "C1"),
]


# ================= PDF =================

PAGE_W = 595.28
PAGE_H = 841.89
MARGIN = 50
CONTENT_W = PAGE_W - 2 * MARGIN


def _rgb(color: tuple[int, int, int]) -> tuple[float, float, float]:
    return (color[0] / 255, color[1] / 255, color[2] / 255)


def _wrap(text: str, font: str, size: float, max_width: float) -> list[str]:
    lines: list[str] = []
    for paragraph in text.split("\n"):
        if not paragraph.strip():
            lines.append("")
            continue
        words = paragraph.split()
        current = words[0]
        for word in words[1:]:
            test = f"{current} {word}"
            if fitz.get_text_length(test, fontname=font, fontsize=size) > max_width:
                lines.append(current)
                current = word
            else:
                current = test
        lines.append(current)
    return lines


def build_pdf(issue: SentIssue, spotlight_image: Optional[bytes] = None) -> bytes:
    """Render a Briefing-styled archive PDF for a sent issue.

    Echoes the HTML Briefing hierarchy: cream paper, brown-black ink, Cloudera
    orange accents, masthead + kicker + headline + section labels. Helvetica is
    used (PyMuPDF built-in); Plus Jakarta Sans embedding is deferred — the HTML
    is the brand-font channel.
    """
    doc = fitz.open()

    body_font = "helv"
    bold_font = "hebo"
    ital_font = "hebi"

    def new_page() -> fitz.Page:
        p = doc.new_page(width=PAGE_W, height=PAGE_H)
        # Paint the full cream paper field.
        p.draw_rect(fitz.Rect(0, 0, PAGE_W, PAGE_H), color=None, fill=_rgb(PAPER))
        return p

    page = new_page()

    def ensure(y: float, needed: float) -> tuple[fitz.Page, float]:
        nonlocal page
        if y + needed > PAGE_H - MARGIN:
            page = new_page()
            return page, MARGIN + 6
        return page, y

    # --- Top dark strip: Vol · No · Date, with the Cloudera dot wordmark. ---
    strip_h = 30
    page.draw_rect(fitz.Rect(0, 0, PAGE_W, strip_h), color=None, fill=_rgb(INK))
    vol = derive_volume(issue.ship_date)
    date_str = _format_date(issue.ship_date or issue.sent_at)
    page.insert_text(
        fitz.Point(MARGIN, 19),
        f"VOL. {vol:02d}   ·   NO. {issue.issue_number:02d}   ·   {date_str.upper()}",
        fontname=bold_font,
        fontsize=8,
        color=_rgb(PAPER),
    )
    page.draw_circle(fitz.Point(PAGE_W - MARGIN - 56, 15), 4, color=None, fill=_rgb(CLOUDERA_ORANGE))
    page.insert_text(
        fitz.Point(PAGE_W - MARGIN - 48, 19), "CLOUDERA", fontname=bold_font, fontsize=9, color=_rgb(PAPER)
    )

    # --- Masthead: tagline / The Retail Read / byline. ---
    y = strip_h + 34
    tagline = "A BI-WEEKLY BRIEFING ON AI IN RETAIL"
    tag_w = fitz.get_text_length(tagline, fontname=bold_font, fontsize=8)
    page.insert_text(fitz.Point((PAGE_W - tag_w) / 2, y), tagline, fontname=bold_font, fontsize=8, color=_rgb(INK_SOFT))
    y += 30
    mast = "The Retail Read"
    mast_w = fitz.get_text_length(mast, fontname=bold_font, fontsize=34)
    page.insert_text(fitz.Point((PAGE_W - mast_w) / 2, y), mast, fontname=bold_font, fontsize=34, color=_rgb(INK))
    page.draw_rect(
        fitz.Rect((PAGE_W + mast_w) / 2 + 4, y - 10, (PAGE_W + mast_w) / 2 + 11, y - 3),
        color=None,
        fill=_rgb(CLOUDERA_ORANGE),
    )
    y += 18
    byline = f"EDITED BY {AUTHOR_NAME.upper()}  ·  {AUTHOR_TITLE.upper()}  ·  {AUTHOR_COMPANY.upper()}"
    by_w = fitz.get_text_length(byline, fontname=bold_font, fontsize=7)
    page.insert_text(fitz.Point((PAGE_W - by_w) / 2, y), byline, fontname=bold_font, fontsize=7, color=_rgb(INK_SOFT))
    y += 18

    # --- Double rule. ---
    page.draw_rect(fitz.Rect(MARGIN, y, MARGIN + CONTENT_W, y + 3), color=None, fill=_rgb(INK))
    page.draw_rect(fitz.Rect(MARGIN, y + 6, MARGIN + CONTENT_W, y + 7), color=None, fill=_rgb(INK))
    y += 26

    # --- Kicker + headline. ---
    kicker = (issue.kicker or "").strip().upper() or "FEATURE"
    page.insert_text(fitz.Point(MARGIN, y), kicker, fontname=bold_font, fontsize=8, color=_rgb(CLOUDERA_ORANGE))
    y += 22
    for line in _wrap(issue.title or "", bold_font, 24, CONTENT_W):
        page, y = ensure(y, 28)
        page.insert_text(fitz.Point(MARGIN, y), line, fontname=bold_font, fontsize=24, color=_rgb(INK))
        y += 28
    y += 10

    def section_header(title: str, yy: float) -> float:
        page, yy = ensure(yy, 30)
        page.draw_rect(fitz.Rect(MARGIN, yy, MARGIN + CONTENT_W, yy + 2), color=None, fill=_rgb(INK))
        yy += 16
        page.insert_text(
            fitz.Point(MARGIN, yy), title.upper(), fontname=bold_font, fontsize=10, color=_rgb(INK)
        )
        return yy + 16

    def prose(text: str, yy: float, size: float = 10.5, leading: float = 15) -> float:
        for line in _wrap(text, body_font, size, CONTENT_W):
            page, yy = ensure(yy, leading)
            if line:
                page.insert_text(fitz.Point(MARGIN, yy), line, fontname=body_font, fontsize=size, color=_rgb(INK))
            yy += leading
        return yy

    def bullet(text: str, yy: float, size: float = 10.5, leading: float = 15) -> float:
        wrapped = _wrap(text, body_font, size, CONTENT_W - 16)
        for idx, line in enumerate(wrapped):
            page, yy = ensure(yy, leading)
            if idx == 0:
                page.insert_text(fitz.Point(MARGIN, yy), "•", fontname=body_font, fontsize=size, color=_rgb(CLOUDERA_ORANGE))
            page.insert_text(fitz.Point(MARGIN + 16, yy), line, fontname=body_font, fontsize=size, color=_rgb(INK))
            yy += leading
        return yy + 3

    s = issue.sections

    # 1. The Read
    y = section_header("The Read", y)
    y = prose(s.the_read.content or "—", y)
    y += 14

    # 2. What's Moving
    y = section_header("What's Moving", y)
    for line in _whats_moving_lines(s):
        y = bullet(line, y)
    y += 11

    # 3. Use Case Spotlight
    y = section_header("Use Case Spotlight", y)
    if s.use_case_spotlight.tailored_for_account:
        page, y = ensure(y, 14)
        page.insert_text(
            fitz.Point(MARGIN, y),
            f"Tailored for {s.use_case_spotlight.tailored_for_account}",
            fontname=ital_font,
            fontsize=9,
            color=_rgb(CLOUDERA_ORANGE),
        )
        y += 16
    y = prose(s.use_case_spotlight.content or "—", y)
    if spotlight_image:
        try:
            img_rect = fitz.Rect(MARGIN, y + 6, MARGIN + CONTENT_W, y + 6 + CONTENT_W * 0.5)
            page, y = ensure(y, img_rect.height + 12)
            img_rect = fitz.Rect(MARGIN, y + 6, MARGIN + CONTENT_W, y + 6 + CONTENT_W * 0.5)
            page.insert_image(img_rect, stream=spotlight_image, keep_proportion=True)
            # 1px ink border, no rounding (Briefing image treatment).
            page.draw_rect(img_rect, color=_rgb(RULE_FAINT), width=0.8)
            y = img_rect.y1 + 8
        except Exception:  # noqa: BLE001 — a bad image must not break the PDF
            pass
    y += 14

    # 4. Wins & References
    y = section_header("Wins & References", y)
    for item in _bullets(s.wins.items):
        y = bullet(item, y)
    y += 11

    # 5. On the Horizon
    y = section_header("On the Horizon", y)
    for item in _bullets(s.horizon.items):
        y = bullet(item, y)
    y += 16

    # Footer CTA + colophon.
    if issue.footer_cta:
        page, y = ensure(y, 30)
        page.draw_rect(fitz.Rect(MARGIN, y, MARGIN + CONTENT_W, y + 0.8), color=None, fill=_rgb(RULE_FAINT))
        y += 16
        y = prose(issue.footer_cta, y, size=10, leading=14)
        y += 6

    page, y = ensure(y, 60)
    page.draw_rect(fitz.Rect(MARGIN, y, MARGIN + CONTENT_W, y + 2), color=None, fill=_rgb(INK))
    y += 18
    page.insert_text(fitz.Point(MARGIN, y), AUTHOR_NAME, fontname=bold_font, fontsize=10, color=_rgb(INK))
    y += 14
    page.insert_text(fitz.Point(MARGIN, y), AUTHOR_TITLE, fontname=body_font, fontsize=9, color=_rgb(INK_SOFT))
    y += 12
    page.insert_text(fitz.Point(MARGIN, y), AUTHOR_COMPANY, fontname=body_font, fontsize=9, color=_rgb(INK_SOFT))
    y += 12
    page.insert_text(fitz.Point(MARGIN, y), AUTHOR_CONTACT, fontname=body_font, fontsize=9, color=_rgb(CLOUDERA_ORANGE))

    return doc.tobytes()


# ================= Email HTML =================


def _data_uri(data: Optional[bytes], mime: str) -> Optional[str]:
    if not data:
        return None
    return f"data:{mime};base64,{base64.b64encode(data).decode('ascii')}"


def build_email_html(
    issue: SentIssue,
    spotlight_image: Optional[bytes] = None,
    spotlight_image_mime: str = "image/png",
    hero_image: Optional[bytes] = None,
    hero_image_mime: str = "image/jpeg",
    booking_url: str = "#",
    spotlight_title: Optional[str] = None,
    reply_cta_heading: str = "Reply ›",
    reply_cta_body: str = "What account is this hitting? Send the name.",
    book_cta_heading: str = "Book ›",
    book_cta_body: str = "30-min walkthrough of any use case.",
) -> str:
    """Render the Briefing email (Plus Jakarta Sans throughout) via Jinja2.

    Hero + spotlight images are base64-embedded as data URIs (self-contained, no
    host dependency — renders in the preview iframe and survives paste). Slots
    collapse gracefully when their source section is empty.
    """
    s = issue.sections
    the_read = (s.the_read.content or "").strip()

    # Sections present (drives both the slots and the TOC).
    present: dict[str, bool] = {
        "the_read": bool(the_read),
        "whats_moving": bool(_whats_moving_lines(s)),
        "use_case_spotlight": bool((s.use_case_spotlight.content or "").strip()),
        "wins": bool(_bullets(s.wins.items)),
        "horizon": bool(_bullets(s.horizon.items)),
    }

    # The Read renders as discrete paragraphs (split on blank lines). The drop cap
    # floats on the first letter of the first paragraph; the remaining paragraphs
    # each become their own <p>. All plain text, autoescaped.
    the_read_paras = _paragraphs(the_read)
    first_para = the_read_paras[0] if the_read_paras else ""
    first_letter = first_para[:1]
    first_rest = first_para[1:]
    more_paras = the_read_paras[1:]

    # Spotlight title: resolved POV name when supplied, else the section default.
    spotlight_ctx = None
    if present["use_case_spotlight"]:
        spotlight_ctx = {
            "title": (spotlight_title or "").strip() or "Use Case Spotlight",
            "paragraphs": _paragraphs(s.use_case_spotlight.content or ""),
            "tailored_for": (s.use_case_spotlight.tailored_for_account or "").strip() or None,
            "image_data_uri": _data_uri(spotlight_image, spotlight_image_mime),
        }

    toc = [
        {"label": label, "ref": ref}
        for key, label, ref in _TOC_MAP
        if present.get(key)
    ]

    reply_subject = urllib.parse.quote(
        f"Re: The Retail Read · No. {issue.issue_number:02d}"
    )

    ctx = {
        "issue_no": f"{issue.issue_number:02d}",
        "volume": f"{derive_volume(issue.ship_date):02d}",
        "date_str": _format_date(issue.ship_date or issue.sent_at).replace(" ", " "),
        "kicker": (issue.kicker or "").strip().upper() or "FEATURE",
        "headline_html": headline_with_em(issue.title),
        "subhead": derive_subhead(the_read) if present["the_read"] else "",
        "toc": toc,
        "hero_data_uri": _data_uri(hero_image, hero_image_mime),
        "hero_caption": (issue.hero_caption or "").strip() or None,
        "the_read": the_read,
        "the_read_first_letter": first_letter,
        "the_read_first_rest": first_rest,
        "the_read_more_paragraphs": more_paras,
        "pull_quote": derive_pull_quote(the_read) if present["the_read"] else None,
        "spotlight": spotlight_ctx,
        "wins": _bullets(s.wins.items),
        "reading": _whats_moving_lines(s),
        "events": _bullets(s.horizon.items),
        "footer_cta": (issue.footer_cta or "").strip(),
        "booking_url": booking_url or "#",
        "reply_subject": reply_subject,
        "reply_cta_heading": (reply_cta_heading or "").strip() or "Reply ›",
        "reply_cta_body": (reply_cta_body or "").strip(),
        "book_cta_heading": (book_cta_heading or "").strip() or "Book ›",
        "book_cta_body": (book_cta_body or "").strip(),
        "author_name": AUTHOR_NAME,
        "author_title": AUTHOR_TITLE,
        "author_company": AUTHOR_COMPANY,
        "author_contact": AUTHOR_CONTACT,
        # Official brand wordmarks, base64-inlined (bypass hero auto-compression —
        # already tiny), each trimmed to its content box. Masthead sits on the
        # dark strip; the colophon wordmark sits on cream.
        "masthead_logo_uri": _trimmed_logo_uri("cloudera-logo.png"),
        "colophon_wordmark_uri": _trimmed_logo_uri("Cloudera_logo_darkorange.png"),
    }

    template = _jinja_env.get_template("briefing_email.html.j2")
    return template.render(**ctx)


# ================= Slack text =================


def build_slack_text(issue: SentIssue) -> str:
    """Plain text with Slack markdown (*bold*, • bullets)."""
    s = issue.sections
    out: list[str] = []
    out.append(f"*The Retail Read — Issue {issue.issue_number:03d}*")
    out.append(f"_{_format_date(issue.sent_at)}_")
    out.append("")

    out.append("*The Read*")
    out.append(s.the_read.content.strip() or "—")
    out.append("")

    out.append("*What's Moving*")
    wm = _whats_moving_lines(s)
    out.extend([f"• {line}" for line in wm] or ["—"])
    out.append("")

    out.append("*Use Case Spotlight*")
    if s.use_case_spotlight.tailored_for_account:
        out.append(f"_Tailored for {s.use_case_spotlight.tailored_for_account}_")
    out.append(s.use_case_spotlight.content.strip() or "—")
    out.append("")

    out.append("*Wins & References*")
    out.extend([f"• {i}" for i in _bullets(s.wins.items)] or ["—"])
    out.append("")

    out.append("*On the Horizon*")
    out.extend([f"• {i}" for i in _bullets(s.horizon.items)] or ["—"])
    out.append("")

    if issue.footer_cta.strip():
        out.append(issue.footer_cta.strip())
        out.append("")

    out.append(f"*{AUTHOR_NAME}* · {AUTHOR_TITLE} · {AUTHOR_COMPANY} · {AUTHOR_CONTACT}")
    return "\n".join(out)
