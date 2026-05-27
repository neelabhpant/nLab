"""Export builders for The Retail Read — PDF, email HTML, Slack text.

Three pure functions that turn a SentIssue into a distribution artifact.
- build_email_html: single-column inline-CSS HTML for paste-into-Outlook.
- build_pdf: the same Briefing HTML rendered to PDF by headless Chromium
  (Playwright) with the brand fonts embedded — visually identical to the HTML.
- build_slack_text: plain text with Slack markdown.

See NEWSLETTER_COMPOSER_SPEC.md §8.
"""

from __future__ import annotations

import asyncio
import base64
import html as html_lib
import io
import re
import threading
import urllib.parse
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Optional

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
# we use `|safe` deliberately only for the headline (where we inject <em>) and
# via the `linkify` filter (which builds its own escaped <a> tags).
_TEMPLATE_DIR = Path(__file__).resolve().parent / "templates"
_jinja_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATE_DIR)),
    autoescape=select_autoescape(["html", "j2", "html.j2"]),
)

# Inline link styling — matches the colophon email link (orange text + orange
# underline), inheriting the surrounding body font/size.
_LINK_STYLE = "color:#F96302;text-decoration:none;border-bottom:1px solid #F96302;"
# Markdown inline link: [label](url). URL stops at whitespace or the closing paren.
_MD_LINK = re.compile(r"\[([^\]]+)\]\(([^)\s]+)\)")
# Only these schemes become links; anything else renders as inert escaped text.
_SAFE_URL = re.compile(r"^(https?:|mailto:)", re.IGNORECASE)


def linkify(text: Optional[str]) -> "Markup":
    """Render markdown-style links ``[label](url)`` in body text as styled <a> tags.

    Everything outside a link is HTML-escaped; inside a link, the label and URL are
    escaped too, so the only injected markup is the intended anchor. The result is
    marked safe for the template. Non-http(s)/mailto URLs are dropped to inert text.
    Generalized for all section body fields — asset references, calendar invites,
    demo videos, etc.
    """
    from markupsafe import Markup, escape

    if not text:
        return Markup("")
    parts: list[str] = []
    cursor = 0
    for match in _MD_LINK.finditer(str(text)):
        parts.append(str(escape(text[cursor:match.start()])))
        label, url = match.group(1), match.group(2)
        if _SAFE_URL.match(url):
            parts.append(
                f'<a href="{escape(url)}" style="{_LINK_STYLE}">{escape(label)}</a>'
            )
        else:
            parts.append(str(escape(match.group(0))))  # not a safe scheme → literal
        cursor = match.end()
    parts.append(str(escape(text[cursor:])))
    return Markup("".join(parts))


_jinja_env.filters["linkify"] = linkify


def _slack_links(text: str) -> str:
    """Convert markdown ``[label](url)`` to Slack's ``<url|label>`` link format."""
    return _MD_LINK.sub(lambda m: f"<{m.group(2)}|{m.group(1)}>", text or "")

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


def _trimmed_logo_uri(filename: str, target_width: int = 200) -> Optional[str]:
    """Base64 data URI for an orange-on-transparent Cloudera wordmark — trimmed
    to its content box and downscaled to a small uniform width.

    Two reasons to downscale to ``target_width`` (2× the ~100px display size, for
    retina crispness):
      1. The source wordmarks differ wildly in native size (the masthead PNG
         trims to ~688px, the colophon PNG is ~5132px). Email clients that drop
         the ``width`` attribute then render them at those native sizes — the
         5132px one balloons the whole layout. Capping both at the same small
         width makes the two placements behave identically and can't blow out.
      2. Keeps the inlined bytes tiny.

    Trimming removes transparent padding; the wordmark pixels/colors are
    untouched. Falls back to the raw bytes if Pillow is unavailable.
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
        if img.width > target_width:
            new_height = max(1, round(img.height * target_width / img.width))
            img = img.resize((target_width, new_height), Image.LANCZOS)
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


# TOC: ordered section label mapping, keyed by section. Only non-empty sections
# appear (caller filters). The TOC's leading 01–05 numbers come from render order.
_TOC_MAP: list[tuple[str, str]] = [
    ("the_read", "The Read"),
    ("whats_moving", "What's Moving"),
    ("use_case_spotlight", "Use Case Spotlight"),
    ("wins", "Wins & References"),
    ("horizon", "On The Horizon"),
]


# ================= PDF (HTML → PDF via headless Chromium) =================
#
# The PDF is the Briefing email HTML rendered by Chromium (Playwright), so it is
# visually identical to the HTML preview — three-tier masthead, hero image, drop
# cap, pull quote, full-width spotlight, two-column CTA box, colophon wordmark,
# cream paper, orange accents and all. The brand fonts are instanced with
# fonttools and base64-embedded via @font-face, so the output is self-contained
# and never depends on the Google Fonts CDN. See scripts/build_pdf_fonts.py.

_FONT_DIR = Path(__file__).resolve().parent / "fonts"

# (file slug, CSS family, weight, style) — mirrors scripts/build_pdf_fonts.py.
_PDF_FONTS: list[tuple[str, str, int, str]] = [
    *[("PlusJakartaSans", "Plus Jakarta Sans", w, "normal") for w in (400, 500, 600, 700, 800)],
    *[("PlusJakartaSans-Italic", "Plus Jakarta Sans", w, "italic") for w in (400, 500, 600, 700, 800)],
    *[("JetBrainsMono", "JetBrains Mono", w, "normal") for w in (400, 500, 600)],
]


@lru_cache(maxsize=1)
def _font_face_css() -> str:
    """@font-face rules embedding the instanced brand fonts as base64 (cached).

    Returns '' if the font files are missing, in which case the render falls back
    to the template's Helvetica/Arial stack rather than failing.
    """
    rules: list[str] = []
    for slug, family, weight, style in _PDF_FONTS:
        try:
            b64 = base64.b64encode((_FONT_DIR / f"{slug}-{weight}.ttf").read_bytes()).decode("ascii")
        except OSError:
            continue
        rules.append(
            f"@font-face{{font-family:'{family}';font-style:{style};font-weight:{weight};"
            f"font-display:block;src:url(data:font/ttf;base64,{b64}) format('truetype');}}"
        )
    return "".join(rules)


def _inline_fonts_for_print(html: str) -> str:
    """Swap the Google Fonts CDN <link> for locally embedded @font-face rules.

    Keeps the rendered PDF self-contained and deterministic (no network at render
    time). If no fonts are embedded, the HTML is returned unchanged.
    """
    css = _font_face_css()
    if not css:
        return html
    html = re.sub(r"<link[^>]+fonts\.googleapis\.com/css2[^>]*>", "", html, flags=re.IGNORECASE)
    return html.replace("</head>", f"<style>{css}</style></head>", 1)


async def _render_pdf_async(html: str) -> bytes:
    """Render HTML to a single content-sized PDF page with Chromium."""
    from playwright.async_api import async_playwright

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=["--no-sandbox"])
        try:
            # Render at the email's 600px design width so the layout fills the page
            # edge-to-edge (no stray cream margins from a wider default viewport).
            page = await browser.new_page(viewport={"width": 600, "height": 1024})
            await page.set_content(html, wait_until="load")
            # Block on embedded @font-face loading so glyphs are present in the snapshot.
            try:
                await page.evaluate("document.fonts.ready")
            except Exception:  # noqa: BLE001 — fonts.ready is best-effort
                pass
            # One continuous page sized to the content height — matches the HTML preview
            # rather than chopping the layout across A4 pages.
            height = await page.evaluate("() => document.body.scrollHeight")
            return await page.pdf(
                width="600px",
                height=f"{int(height) + 2}px",
                print_background=True,
                margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
            )
        finally:
            await browser.close()


def render_html_to_pdf(html: str) -> bytes:
    """Render the Briefing HTML to a self-contained PDF via headless Chromium.

    Runs the async Playwright render in a dedicated thread (with its own event
    loop) so it is callable from sync code and from inside a running event loop
    alike. Async callers should wrap this in ``asyncio.to_thread`` to avoid
    blocking their loop for the duration of the render.
    """
    print_html = _inline_fonts_for_print(html)
    box: dict[str, object] = {}

    def _worker() -> None:
        try:
            box["pdf"] = asyncio.run(_render_pdf_async(print_html))
        except BaseException as exc:  # noqa: BLE001 — surfaced on the calling thread
            box["err"] = exc

    thread = threading.Thread(target=_worker, name="pdf-render")
    thread.start()
    thread.join()
    if "err" in box:
        raise box["err"]  # type: ignore[misc]
    return box["pdf"]  # type: ignore[return-value]


def build_pdf(
    issue: SentIssue,
    spotlight_image: Optional[bytes] = None,
    spotlight_image_mime: str = "image/png",
    hero_image: Optional[bytes] = None,
    hero_image_mime: str = "image/jpeg",
    booking_url: str = "#",
    spotlight_title: Optional[str] = None,
) -> bytes:
    """Render the archive PDF: the Briefing email HTML, rendered by Chromium.

    Visually identical to build_email_html's output (same template, same inlined
    images), with the brand fonts embedded so it never depends on the CDN.
    """
    html = build_email_html(
        issue,
        spotlight_image=spotlight_image,
        spotlight_image_mime=spotlight_image_mime,
        hero_image=hero_image,
        hero_image_mime=hero_image_mime,
        booking_url=booking_url,
        spotlight_title=spotlight_title,
    )
    return render_html_to_pdf(html)


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
        {"label": label}
        for key, label in _TOC_MAP
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
    out.append(_slack_links(s.the_read.content.strip()) or "—")
    out.append("")

    out.append("*What's Moving*")
    wm = _whats_moving_lines(s)
    out.extend([f"• {_slack_links(line)}" for line in wm] or ["—"])
    out.append("")

    out.append("*Use Case Spotlight*")
    if s.use_case_spotlight.tailored_for_account:
        out.append(f"_Tailored for {s.use_case_spotlight.tailored_for_account}_")
    out.append(_slack_links(s.use_case_spotlight.content.strip()) or "—")
    out.append("")

    out.append("*Wins & References*")
    out.extend([f"• {_slack_links(i)}" for i in _bullets(s.wins.items)] or ["—"])
    out.append("")

    out.append("*On the Horizon*")
    out.extend([f"• {_slack_links(i)}" for i in _bullets(s.horizon.items)] or ["—"])
    out.append("")

    if issue.footer_cta.strip():
        out.append(_slack_links(issue.footer_cta.strip()))
        out.append("")

    out.append(f"*{AUTHOR_NAME}* · {AUTHOR_TITLE} · {AUTHOR_COMPANY} · {AUTHOR_CONTACT}")
    return "\n".join(out)
