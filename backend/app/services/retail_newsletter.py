"""Retail Use Case Sparks Newsletter — PDF generation + email delivery."""

import logging
import smtplib
import uuid
from datetime import datetime, timezone
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

import fitz

from app.config import get_settings

logger = logging.getLogger(__name__)

NEWSLETTER_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "newsletters"
NEWSLETTER_DIR.mkdir(parents=True, exist_ok=True)

COLORS = {
    "navy": (15, 23, 42),
    "dark_slate": (30, 41, 59),
    "slate700": (51, 65, 85),
    "slate500": (100, 116, 139),
    "slate400": (148, 163, 184),
    "slate200": (226, 232, 240),
    "slate100": (241, 245, 249),
    "white": (255, 255, 255),
    "sky600": (2, 132, 199),
    "sky100": (224, 242, 254),
    "amber600": (217, 119, 6),
    "amber50": (255, 251, 235),
    "emerald600": (5, 150, 105),
    "emerald50": (236, 253, 245),
    "teal600": (13, 148, 136),
    "teal50": (240, 253, 250),
}

PAGE_W = 595.28
PAGE_H = 841.89
MARGIN = 50
CONTENT_W = PAGE_W - 2 * MARGIN


def _rgb(color: tuple[int, int, int]) -> tuple[float, float, float]:
    return (color[0] / 255, color[1] / 255, color[2] / 255)


def _wrap_text(text: str, font: str, size: float, max_width: float) -> list[str]:
    lines: list[str] = []
    for paragraph in text.split("\n"):
        if not paragraph.strip():
            lines.append("")
            continue
        words = paragraph.split()
        if not words:
            lines.append("")
            continue
        current = words[0]
        for word in words[1:]:
            test = current + " " + word
            w = fitz.get_text_length(test, fontname=font, fontsize=size)
            if w > max_width:
                lines.append(current)
                current = word
            else:
                current = test
        lines.append(current)
    return lines


def _draw_rounded_rect(
    page: fitz.Page,
    rect: fitz.Rect,
    radius: float,
    fill_color: tuple[float, float, float] | None = None,
    stroke_color: tuple[float, float, float] | None = None,
    stroke_width: float = 0.5,
) -> None:
    shape = page.new_shape()
    shape.draw_rect(rect)
    shape.finish(
        color=stroke_color,
        fill=fill_color,
        width=stroke_width,
        roundness=radius / min(rect.width, rect.height) if min(rect.width, rect.height) > 0 else 0,
    )
    shape.commit()


def _ensure_space(doc: fitz.Document, page: fitz.Page, y: float, needed: float) -> tuple[fitz.Page, float]:
    if y + needed > PAGE_H - MARGIN:
        page = doc.new_page(width=PAGE_W, height=PAGE_H)
        return page, MARGIN + 10
    return page, y


def generate_sparks_pdf(sparks: list[dict], date_range: str = "") -> tuple[str, bytes]:
    doc = fitz.open()
    page = doc.new_page(width=PAGE_W, height=PAGE_H)

    if not date_range:
        date_range = datetime.now(timezone.utc).strftime("%B %d, %Y")

    header_h = 100
    header_rect = fitz.Rect(0, 0, PAGE_W, header_h)
    _draw_rounded_rect(page, header_rect, 0, fill_color=_rgb(COLORS["navy"]))

    accent_rect = fitz.Rect(0, header_h, PAGE_W, header_h + 3)
    _draw_rounded_rect(page, accent_rect, 0, fill_color=_rgb(COLORS["sky600"]))

    page.insert_text(
        fitz.Point(MARGIN, 35),
        "RETAIL AI USE CASE SPARKS",
        fontname="helv",
        fontsize=9,
        color=_rgb(COLORS["sky600"]),
    )
    page.insert_text(
        fitz.Point(MARGIN, 58),
        "Intelligence Newsletter",
        fontname="helv",
        fontsize=22,
        color=_rgb(COLORS["white"]),
    )
    page.insert_text(
        fitz.Point(MARGIN, 78),
        f"{date_range}  |  {len(sparks)} Use Cases",
        fontname="helv",
        fontsize=10,
        color=_rgb(COLORS["slate400"]),
    )

    y = header_h + 20

    intro_text = (
        "The following use case opportunities have been identified by AI analysis of current retail industry "
        "trends. Each spark connects a real market signal to a specific data and AI architecture opportunity."
    )
    intro_lines = _wrap_text(intro_text, "helv", 9.5, CONTENT_W)
    for line in intro_lines:
        page, y = _ensure_space(doc, page, y, 14)
        page.insert_text(fitz.Point(MARGIN, y), line, fontname="helv", fontsize=9.5, color=_rgb(COLORS["slate700"]))
        y += 14
    y += 10

    for idx, spark in enumerate(sparks):
        confidence = spark.get("confidence", 0)
        if isinstance(confidence, float) and confidence <= 1:
            confidence = int(confidence * 100)
        else:
            confidence = int(confidence)

        title = spark.get("title", "Untitled")
        description = spark.get("description", "")
        problem = spark.get("retail_problem", "")
        architecture = spark.get("architecture_flow", "")
        why_we_win = spark.get("competitive_advantage", "")
        capabilities = spark.get("cloudera_capabilities", [])
        source_article = spark.get("article_title", "")

        sections: list[tuple[str, str, tuple[int, int, int]]] = []
        if problem:
            sections.append(("PROBLEM", problem, COLORS["slate500"]))
        if architecture:
            sections.append(("ARCHITECTURE", architecture, COLORS["slate500"]))
        if why_we_win:
            sections.append(("WHY CLOUDERA", why_we_win, COLORS["teal600"]))

        desc_lines = _wrap_text(description, "helv", 9, CONTENT_W - 24) if description else []
        section_line_counts: list[list[str]] = []
        for _, text, _ in sections:
            section_line_counts.append(_wrap_text(text, "helv", 9, CONTENT_W - 24))

        card_h = 30 + len(desc_lines) * 13
        for sl in section_line_counts:
            card_h += 18 + len(sl) * 13
        if capabilities:
            card_h += 28
        if source_article:
            card_h += 16
        card_h += 10

        page, y = _ensure_space(doc, page, y, card_h + 12)

        card_rect = fitz.Rect(MARGIN, y, PAGE_W - MARGIN, y + card_h)
        _draw_rounded_rect(page, card_rect, 4, fill_color=_rgb(COLORS["white"]), stroke_color=_rgb(COLORS["slate200"]))

        if confidence >= 80:
            accent_color = COLORS["emerald600"]
        elif confidence >= 60:
            accent_color = COLORS["amber600"]
        else:
            accent_color = COLORS["slate500"]

        accent_bar = fitz.Rect(MARGIN, y, MARGIN + 4, y + card_h)
        _draw_rounded_rect(page, accent_bar, 2, fill_color=_rgb(accent_color))

        cy = y + 18
        page.insert_text(
            fitz.Point(MARGIN + 14, cy),
            title,
            fontname="helv",
            fontsize=11,
            color=_rgb(COLORS["navy"]),
        )

        conf_text = f"{confidence}%"
        conf_w = fitz.get_text_length(conf_text, fontname="helv", fontsize=8) + 10
        title_w = fitz.get_text_length(title, fontname="helv", fontsize=11)
        conf_x = MARGIN + 14 + title_w + 8
        if conf_x + conf_w > PAGE_W - MARGIN - 10:
            conf_x = PAGE_W - MARGIN - conf_w - 10

        conf_bg = COLORS["emerald50"] if confidence >= 75 else COLORS["amber50"]
        conf_fg = COLORS["emerald600"] if confidence >= 75 else COLORS["amber600"]
        badge_rect = fitz.Rect(conf_x, cy - 10, conf_x + conf_w, cy + 2)
        _draw_rounded_rect(page, badge_rect, 3, fill_color=_rgb(conf_bg))
        page.insert_text(
            fitz.Point(conf_x + 5, cy - 1),
            conf_text,
            fontname="helv",
            fontsize=8,
            color=_rgb(conf_fg),
        )

        cy += 8

        if desc_lines:
            for line in desc_lines:
                page.insert_text(
                    fitz.Point(MARGIN + 14, cy),
                    line,
                    fontname="helv",
                    fontsize=9,
                    color=_rgb(COLORS["slate700"]),
                )
                cy += 13
            cy += 4

        for i, (label, _, label_color) in enumerate(sections):
            page.insert_text(
                fitz.Point(MARGIN + 14, cy),
                label,
                fontname="helv",
                fontsize=7.5,
                color=_rgb(label_color),
            )
            cy += 12
            for line in section_line_counts[i]:
                page.insert_text(
                    fitz.Point(MARGIN + 14, cy),
                    line,
                    fontname="helv",
                    fontsize=9,
                    color=_rgb(COLORS["slate700"]),
                )
                cy += 13
            cy += 4

        if capabilities:
            cx = MARGIN + 14
            for cap in capabilities:
                cap_label = cap.split(":")[0].strip() if ":" in cap else cap
                cap_w = fitz.get_text_length(cap_label, fontname="helv", fontsize=7) + 10
                if cx + cap_w > PAGE_W - MARGIN - 10:
                    cy += 16
                    cx = MARGIN + 14
                chip_rect = fitz.Rect(cx, cy - 8, cx + cap_w, cy + 4)
                _draw_rounded_rect(page, chip_rect, 3, fill_color=_rgb(COLORS["sky100"]))
                page.insert_text(
                    fitz.Point(cx + 5, cy + 1),
                    cap_label,
                    fontname="helv",
                    fontsize=7,
                    color=_rgb(COLORS["sky600"]),
                )
                cx += cap_w + 6
            cy += 14

        if source_article:
            page.insert_text(
                fitz.Point(MARGIN + 14, cy),
                f"Source: {source_article}",
                fontname="helv",
                fontsize=7.5,
                color=_rgb(COLORS["slate400"]),
            )

        y += card_h + 12

    page, y = _ensure_space(doc, page, y, 30)
    y += 8
    shape = page.new_shape()
    shape.draw_line(fitz.Point(MARGIN, y), fitz.Point(PAGE_W - MARGIN, y))
    shape.finish(color=_rgb(COLORS["slate200"]), width=0.5)
    shape.commit()
    y += 14

    page.insert_text(
        fitz.Point(MARGIN, y),
        "Generated by nLab Retail Intelligence",
        fontname="helv",
        fontsize=7.5,
        color=_rgb(COLORS["slate400"]),
    )
    page.insert_text(
        fitz.Point(PAGE_W - MARGIN - fitz.get_text_length("Confidential — For internal use only", fontname="helv", fontsize=7.5), y),
        "Confidential — For internal use only",
        fontname="helv",
        fontsize=7.5,
        color=_rgb(COLORS["slate400"]),
    )

    total_pages = len(doc)
    for i in range(total_pages):
        p = doc[i]
        pn_text = f"Page {i + 1} of {total_pages}"
        pn_w = fitz.get_text_length(pn_text, fontname="helv", fontsize=7)
        p.insert_text(
            fitz.Point(PAGE_W - MARGIN - pn_w, PAGE_H - 25),
            pn_text,
            fontname="helv",
            fontsize=7,
            color=_rgb(COLORS["slate400"]),
        )

    pdf_bytes = doc.tobytes()
    file_id = str(uuid.uuid4())[:12]
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    filename = f"sparks-newsletter-{date_str}-{file_id}.pdf"
    out_path = NEWSLETTER_DIR / filename
    out_path.write_bytes(pdf_bytes)

    doc.close()
    return file_id, pdf_bytes


def get_newsletter_path(file_id: str) -> Path | None:
    for f in NEWSLETTER_DIR.iterdir():
        if file_id in f.name and f.suffix == ".pdf":
            return f
    return None


def send_newsletter_email(
    pdf_bytes: bytes,
    recipients: list[str],
    subject: str = "Retail AI Use Case Sparks — Weekly Newsletter",
    body: str = "",
) -> str:
    settings = get_settings()
    if not settings.smtp_host or not settings.smtp_user:
        return "Email not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM_EMAIL in .env."

    if not body:
        body = (
            "Please find attached the latest Retail AI Use Case Sparks newsletter, "
            "featuring AI-identified opportunities linking current retail industry trends "
            "to enterprise data and AI platform capabilities.\n\n"
            "Best regards,\nnLab Retail Intelligence"
        )

    try:
        msg = MIMEMultipart()
        msg["From"] = settings.smtp_from_email or settings.smtp_user
        msg["To"] = ", ".join(recipients)
        msg["Subject"] = subject

        msg.attach(MIMEText(body, "plain"))

        date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        attachment = MIMEApplication(pdf_bytes, _subtype="pdf")
        attachment.add_header(
            "Content-Disposition",
            "attachment",
            filename=f"sparks-newsletter-{date_str}.pdf",
        )
        msg.attach(attachment)

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_password.replace(" ", ""))
            server.send_message(msg)

        return f"Newsletter sent to {', '.join(recipients)}"
    except Exception as e:
        logger.warning("Newsletter email failed: %s", e)
        return f"Email error: {e}"
