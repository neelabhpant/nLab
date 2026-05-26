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
import re
from datetime import datetime
from typing import Optional

import fitz

from app.models.newsletter import IssueSections, SentIssue

# Cloudera brand font. Email clients that strip the web-font <link> fall back
# to the system sans-serif stack; the composer preview (browser) loads it.
EMAIL_FONT_STACK = (
    "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
)
GOOGLE_FONTS_LINK = (
    '<link href="https://fonts.googleapis.com/css2?'
    'family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">'
)

# ---------- Branding ----------

# Cloudera orange + deep navy (spec §8.1).
CLOUDERA_ORANGE = (249, 99, 2)
DEEP_NAVY = (15, 23, 41)
SLATE_700 = (51, 65, 85)
SLATE_500 = (100, 116, 139)
SLATE_300 = (203, 213, 225)
SLATE_100 = (241, 245, 249)
WHITE = (255, 255, 255)

ORANGE_HEX = "#F96302"
NAVY_HEX = "#0F1729"

AUTHOR_NAME = "Neelabh Pant"
AUTHOR_TITLE = "Director, Global AI Industry Solutions — Retail"
AUTHOR_COMPANY = "Cloudera"
AUTHOR_CONTACT = "npant@cloudera.com"

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


def _whats_moving_lines(sections: IssueSections) -> list[str]:
    return [i.line.strip() for i in sections.whats_moving.items if i.line and i.line.strip()]


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
    """Render a Cloudera-branded archive PDF for a sent issue."""
    doc = fitz.open()
    page = doc.new_page(width=PAGE_W, height=PAGE_H)

    body_font = "helv"
    bold_font = "hebo"

    def ensure(y: float, needed: float) -> tuple[fitz.Page, float]:
        nonlocal page
        if y + needed > PAGE_H - MARGIN:
            page = doc.new_page(width=PAGE_W, height=PAGE_H)
            return page, MARGIN + 6
        return page, y

    # --- Header band (Option A: wordmark / editorial headline / meta) ---
    title_lines = _wrap(issue.title or "", bold_font, 15, CONTENT_W)[:2]
    wordmark_y = 34
    title_y0 = 58
    title_leading = 19
    meta_y = title_y0 + (len(title_lines) - 1) * title_leading + 26
    header_h = meta_y + 16

    page.draw_rect(fitz.Rect(0, 0, PAGE_W, header_h), color=None, fill=_rgb(DEEP_NAVY))
    page.draw_rect(fitz.Rect(0, header_h - 5, PAGE_W, header_h), color=None, fill=_rgb(CLOUDERA_ORANGE))
    # Tier 1 — brand wordmark.
    page.insert_text(
        fitz.Point(MARGIN, wordmark_y),
        "THE RETAIL READ",
        fontname=bold_font,
        fontsize=18,
        color=_rgb(WHITE),
    )
    # Tier 2 — editorial headline (the issue title).
    ty = title_y0
    for line in title_lines:
        page.insert_text(fitz.Point(MARGIN, ty), line, fontname=bold_font, fontsize=15, color=_rgb(WHITE))
        ty += title_leading
    # Tier 3 — issue + date meta.
    page.insert_text(
        fitz.Point(MARGIN, meta_y),
        f"Issue {issue.issue_number:03d}  ·  {_format_date(issue.sent_at)}",
        fontname=body_font,
        fontsize=10,
        color=_rgb(SLATE_300),
    )

    y = header_h + 26

    def section_header(title: str, yy: float) -> float:
        page.draw_rect(fitz.Rect(MARGIN, yy - 10, MARGIN + 4, yy + 4), color=None, fill=_rgb(CLOUDERA_ORANGE))
        page.insert_text(
            fitz.Point(MARGIN + 14, yy),
            title.upper(),
            fontname=bold_font,
            fontsize=12,
            color=_rgb(DEEP_NAVY),
        )
        return yy + 18

    def prose(text: str, yy: float, size: float = 10.5, leading: float = 15) -> float:
        for line in _wrap(text, body_font, size, CONTENT_W):
            page, yy = ensure(yy, leading)
            if line:
                page.insert_text(fitz.Point(MARGIN, yy), line, fontname=body_font, fontsize=size, color=_rgb(SLATE_700))
            yy += leading
        return yy

    def bullet(text: str, yy: float, size: float = 10.5, leading: float = 15) -> float:
        wrapped = _wrap(text, body_font, size, CONTENT_W - 16)
        for idx, line in enumerate(wrapped):
            page, yy = ensure(yy, leading)
            if idx == 0:
                page.insert_text(fitz.Point(MARGIN, yy), "•", fontname=body_font, fontsize=size, color=_rgb(CLOUDERA_ORANGE))
            page.insert_text(fitz.Point(MARGIN + 16, yy), line, fontname=body_font, fontsize=size, color=_rgb(SLATE_700))
            yy += leading
        return yy + 3

    s = issue.sections

    # 1. The Read
    page, y = ensure(y, 40)
    y = section_header("The Read", y)
    y = prose(s.the_read.content or "—", y)
    y += 14

    # 2. What's Moving
    page, y = ensure(y, 40)
    y = section_header("What's Moving", y)
    for line in _whats_moving_lines(s):
        y = bullet(line, y)
    y += 11

    # 3. Use Case Spotlight
    page, y = ensure(y, 40)
    y = section_header("Use Case Spotlight", y)
    if s.use_case_spotlight.tailored_for_account:
        page, y = ensure(y, 14)
        page.insert_text(
            fitz.Point(MARGIN, y),
            f"Tailored for {s.use_case_spotlight.tailored_for_account}",
            fontname=bold_font,
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
            y = img_rect.y1 + 8
        except Exception:  # noqa: BLE001 — a bad image must not break the PDF
            pass
    y += 14

    # 4. Wins & References
    page, y = ensure(y, 40)
    y = section_header("Wins & References", y)
    for item in _bullets(s.wins.items):
        y = bullet(item, y)
    y += 11

    # 5. On the Horizon
    page, y = ensure(y, 40)
    y = section_header("On the Horizon", y)
    for item in _bullets(s.horizon.items):
        y = bullet(item, y)
    y += 16

    # Footer CTA + author block
    if issue.footer_cta:
        page, y = ensure(y, 30)
        page.draw_rect(fitz.Rect(MARGIN, y, MARGIN + CONTENT_W, y + 0.6), color=None, fill=_rgb(SLATE_300))
        y += 16
        y = prose(issue.footer_cta, y, size=10, leading=14)
        y += 6

    page, y = ensure(y, 56)
    page.insert_text(fitz.Point(MARGIN, y), AUTHOR_NAME, fontname=bold_font, fontsize=10, color=_rgb(DEEP_NAVY))
    y += 14
    page.insert_text(fitz.Point(MARGIN, y), AUTHOR_TITLE, fontname=body_font, fontsize=9, color=_rgb(SLATE_500))
    y += 12
    page.insert_text(fitz.Point(MARGIN, y), AUTHOR_COMPANY, fontname=body_font, fontsize=9, color=_rgb(SLATE_500))
    y += 12
    page.insert_text(fitz.Point(MARGIN, y), AUTHOR_CONTACT, fontname=body_font, fontsize=9, color=_rgb(CLOUDERA_ORANGE))

    return doc.tobytes()


# ================= Email HTML =================


def _esc(text: str) -> str:
    return html_lib.escape(text or "").replace("\n", "<br>")


def build_email_html(
    issue: SentIssue,
    spotlight_image: Optional[bytes] = None,
    spotlight_image_mime: str = "image/png",
) -> str:
    """Single-column, inline-CSS HTML suitable for pasting into Outlook/Gmail.

    If a spotlight image is supplied it is base64-embedded after the spotlight
    prose (self-contained — no auth or host dependency, renders in the preview
    iframe and survives a paste into a compose window).
    """
    s = issue.sections
    date = _format_date(issue.sent_at)

    def section_block(title: str, inner: str) -> str:
        return (
            f'<tr><td style="padding:24px 32px 0 32px;">'
            f'<div style="border-left:4px solid {ORANGE_HEX};padding-left:12px;">'
            f'<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;'
            f'letter-spacing:1px;text-transform:uppercase;color:{NAVY_HEX};">{html_lib.escape(title, quote=False)}</div>'
            f'</div>{inner}</td></tr>'
        )

    def prose(text: str) -> str:
        return (
            f'<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;'
            f'color:#334155;margin:10px 0 0 0;">{_esc(text or "—")}</p>'
        )

    def bullets(items: list[str]) -> str:
        if not items:
            return prose("—")
        lis = "".join(
            f'<li style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;'
            f'color:#334155;margin-bottom:6px;">{_esc(i)}</li>'
            for i in items
        )
        return f'<ul style="margin:10px 0 0 0;padding-left:20px;">{lis}</ul>'

    tailored = ""
    if s.use_case_spotlight.tailored_for_account:
        tailored = (
            f'<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;'
            f'color:{ORANGE_HEX};margin-top:8px;">Tailored for '
            f'{html_lib.escape(s.use_case_spotlight.tailored_for_account)}</div>'
        )

    spotlight_img = ""
    if spotlight_image:
        b64 = base64.b64encode(spotlight_image).decode("ascii")
        spotlight_img = (
            f'<img src="data:{spotlight_image_mime};base64,{b64}" alt="Demo screenshot" '
            f'style="display:block;width:100%;max-width:100%;height:auto;border-radius:8px;'
            f'border:1px solid #e2e8f0;margin-top:14px;" />'
        )

    footer_cta = ""
    if issue.footer_cta:
        footer_cta = (
            f'<tr><td style="padding:24px 32px 0 32px;">'
            f'<div style="border-top:1px solid #e2e8f0;padding-top:16px;'
            f'font-family:Arial,Helvetica,sans-serif;font-size:14px;font-style:italic;color:#475569;">'
            f'{_esc(issue.footer_cta)}</div></td></tr>'
        )

    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">{GOOGLE_FONTS_LINK}</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;">
  <tr><td style="background:{NAVY_HEX};padding:28px 32px;border-bottom:5px solid {ORANGE_HEX};">
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:{ORANGE_HEX};letter-spacing:2px;text-transform:uppercase;">THE RETAIL READ</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:700;color:#ffffff;line-height:1.25;margin-top:8px;">{html_lib.escape(issue.title, quote=False)}</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#cbd5e1;margin-top:8px;">Issue {issue.issue_number:03d} &nbsp;·&nbsp; {html_lib.escape(date)}</div>
  </td></tr>
  {section_block("The Read", prose(s.the_read.content))}
  {section_block("What's Moving", bullets(_whats_moving_lines(s)))}
  {section_block("Use Case Spotlight", tailored + prose(s.use_case_spotlight.content) + spotlight_img)}
  {section_block("Wins & References", bullets(_bullets(s.wins.items)))}
  {section_block("On the Horizon", bullets(_bullets(s.horizon.items)))}
  {footer_cta}
  <tr><td style="padding:24px 32px 28px 32px;border-top:1px solid #e2e8f0;">
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:{NAVY_HEX};">{html_lib.escape(AUTHOR_NAME)}</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#64748b;margin-top:2px;">{html_lib.escape(AUTHOR_TITLE, quote=False)}</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#64748b;">{html_lib.escape(AUTHOR_COMPANY)}</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:{ORANGE_HEX};margin-top:2px;"><a href="mailto:{html_lib.escape(AUTHOR_CONTACT, quote=True)}" style="color:{ORANGE_HEX};text-decoration:none;">{html_lib.escape(AUTHOR_CONTACT)}</a></div>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>"""
    # Swap the email-safe fallback stack for the Plus Jakarta Sans stack in one place.
    return html.replace("font-family:Arial,Helvetica,sans-serif", f"font-family:{EMAIL_FONT_STACK}")


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
