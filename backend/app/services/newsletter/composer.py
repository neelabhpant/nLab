"""ComposerService — CRUD + draft→sent workflow for The Retail Read.

All persistence goes through the storage abstraction (see services/storage/).
The `newsletter_drafts` and `newsletter_issues` tables (spec §3.2) keep a few
typed columns plus a `content_json` blob holding the section payload + footer.
This service bundles/unbundles between Pydantic models and that storage shape.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.models.newsletter import (
    IssueDraft,
    IssueDraftCreate,
    IssueDraftUpdate,
    IssueSections,
    SentIssue,
)
from app.services.storage import get_storage

logger = logging.getLogger(__name__)


DRAFTS_TABLE = "newsletter_drafts"
ISSUES_TABLE = "newsletter_issues"

# Sections harvested into the voice corpus on send, with the text to extract.
_HARVEST_SECTIONS: tuple[str, ...] = (
    "the_read",
    "whats_moving",
    "use_case_spotlight",
    "wins",
    "horizon",
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return f"draft-{uuid.uuid4().hex[:12]}"


def _new_issue_id() -> str:
    return f"issue-{uuid.uuid4().hex[:12]}"


def _bundle_content(
    sections: IssueSections,
    footer_cta: str,
    title: Optional[str] = None,
    *,
    kicker: Optional[str] = None,
    ship_date: Optional[str] = None,
    hero_image_path: Optional[str] = None,
    hero_caption: Optional[str] = None,
) -> dict:
    """Bundle the section payload + Briefing meta into the `content_json` blob shape."""
    return {
        "sections": sections.model_dump(),
        "footer_cta": footer_cta,
        "title": title,
        "kicker": kicker,
        "ship_date": ship_date,
        "hero_image_path": hero_image_path,
        "hero_caption": hero_caption,
    }


class _UnbundledContent:
    """Lightweight holder for the unbundled content_json blob."""

    __slots__ = ("sections", "footer_cta", "title", "kicker", "ship_date", "hero_image_path", "hero_caption")

    def __init__(
        self,
        sections: IssueSections,
        footer_cta: str,
        title: Optional[str],
        kicker: Optional[str],
        ship_date: Optional[str],
        hero_image_path: Optional[str],
        hero_caption: Optional[str],
    ) -> None:
        self.sections = sections
        self.footer_cta = footer_cta
        self.title = title
        self.kicker = kicker
        self.ship_date = ship_date
        self.hero_image_path = hero_image_path
        self.hero_caption = hero_caption


def _unbundle_content(content: object) -> _UnbundledContent:
    """Reverse of _bundle_content. Tolerant of missing/legacy fields."""
    if not isinstance(content, dict):
        return _UnbundledContent(IssueSections(), "", None, None, None, None, None)
    sections_data = content.get("sections") or {}
    sections = IssueSections(**sections_data) if isinstance(sections_data, dict) else IssueSections()
    return _UnbundledContent(
        sections=sections,
        footer_cta=content.get("footer_cta") or "",
        title=content.get("title"),
        kicker=content.get("kicker"),
        ship_date=content.get("ship_date"),
        hero_image_path=content.get("hero_image_path"),
        hero_caption=content.get("hero_caption"),
    )


def _draft_to_row(draft: IssueDraft) -> dict:
    return {
        "id": draft.id,
        "issue_number": draft.issue_number,
        "status": draft.status,
        "content_json": _bundle_content(
            draft.sections,
            draft.footer_cta,
            draft.title,
            kicker=draft.kicker,
            ship_date=draft.ship_date,
            hero_image_path=draft.hero_image_path,
            hero_caption=draft.hero_caption,
        ),
        "created_at": draft.created_at,
        "updated_at": draft.updated_at,
        "sent_at": draft.sent_at,
    }


def _draft_from_row(row: dict) -> IssueDraft:
    c = _unbundle_content(row.get("content_json"))
    return IssueDraft(
        id=row["id"],
        issue_number=row.get("issue_number"),
        title=c.title,
        kicker=c.kicker,
        ship_date=c.ship_date,
        hero_image_path=c.hero_image_path,
        hero_caption=c.hero_caption,
        status=row.get("status") or "draft",
        sections=c.sections,
        footer_cta=c.footer_cta,
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        sent_at=row.get("sent_at"),
    )


def _issue_to_row(issue: SentIssue) -> dict:
    return {
        "id": issue.id,
        "issue_number": issue.issue_number,
        "slug": issue.slug,
        "title": issue.title,
        "content_json": _bundle_content(
            issue.sections,
            issue.footer_cta,
            kicker=issue.kicker,
            ship_date=issue.ship_date,
            hero_image_path=issue.hero_image_path,
            hero_caption=issue.hero_caption,
        ),
        "pdf_path": issue.pdf_path,
        "html_path": issue.html_path,
        "sent_at": issue.sent_at,
        "recipient_count": issue.recipient_count,
    }


def _issue_from_row(row: dict) -> SentIssue:
    c = _unbundle_content(row.get("content_json"))
    return SentIssue(
        id=row["id"],
        issue_number=row["issue_number"],
        slug=row["slug"],
        title=row["title"],
        kicker=c.kicker,
        ship_date=c.ship_date,
        hero_image_path=c.hero_image_path,
        hero_caption=c.hero_caption,
        sections=c.sections,
        footer_cta=c.footer_cta,
        pdf_path=row.get("pdf_path"),
        html_path=row.get("html_path"),
        sent_at=row["sent_at"],
        recipient_count=row.get("recipient_count"),
    )


class ComposerService:
    """Stateless. Methods are coroutines. Backed by the storage abstraction."""

    DRAFTS_TABLE = DRAFTS_TABLE
    ISSUES_TABLE = ISSUES_TABLE

    # ---------- Draft CRUD ----------

    async def create_draft(self, data: IssueDraftCreate) -> IssueDraft:
        now = _now_iso()
        draft = IssueDraft(
            id=_new_id(),
            status="draft",
            issue_number=data.issue_number,
            title=data.title,
            kicker=data.kicker,
            ship_date=data.ship_date,
            hero_image_path=data.hero_image_path,
            hero_caption=data.hero_caption,
            sections=data.sections,
            footer_cta=data.footer_cta,
            created_at=now,
            updated_at=now,
        )
        storage = get_storage()
        await storage.put(DRAFTS_TABLE, draft.id, _draft_to_row(draft))
        return draft

    async def get_draft(self, draft_id: str) -> Optional[IssueDraft]:
        storage = get_storage()
        row = await storage.get(DRAFTS_TABLE, draft_id)
        return _draft_from_row(row) if row else None

    async def list_drafts(self) -> list[IssueDraft]:
        """All drafts, newest first by updated_at."""
        storage = get_storage()
        rows = await storage.list(DRAFTS_TABLE)
        drafts = [_draft_from_row(r) for r in rows]
        drafts.sort(key=lambda d: d.updated_at, reverse=True)
        return drafts

    async def update_draft(
        self,
        draft_id: str,
        data: IssueDraftUpdate,
    ) -> Optional[IssueDraft]:
        """Partial update. Read-modify-write — the storage layer is full-row."""
        existing = await self.get_draft(draft_id)
        if not existing:
            return None
        patch = data.model_dump(exclude_unset=True)
        sections = patch.get("sections")
        if sections is not None:
            existing.sections = IssueSections(**sections) if isinstance(sections, dict) else sections
        if "footer_cta" in patch:
            existing.footer_cta = patch["footer_cta"] or ""
        if "title" in patch:
            # Empty string clears the explicit title (falls back to derived).
            existing.title = (patch["title"] or "").strip() or None
        if "kicker" in patch:
            existing.kicker = (patch["kicker"] or "").strip() or None
        if "ship_date" in patch:
            existing.ship_date = (patch["ship_date"] or "").strip() or None
        if "hero_image_path" in patch:
            existing.hero_image_path = patch["hero_image_path"] or None
        if "hero_caption" in patch:
            existing.hero_caption = (patch["hero_caption"] or "").strip() or None
        existing.updated_at = _now_iso()
        storage = get_storage()
        await storage.put(DRAFTS_TABLE, draft_id, _draft_to_row(existing))
        return existing

    async def delete_draft(self, draft_id: str) -> bool:
        existing = await self.get_draft(draft_id)
        if not existing:
            return False
        storage = get_storage()
        await storage.delete(DRAFTS_TABLE, draft_id)
        return True

    # ---------- Send flow ----------

    async def mark_sent(
        self,
        draft_id: str,
        recipient_count: Optional[int] = None,
    ) -> Optional[SentIssue]:
        """Move draft → issues. Assigns issue_number + slug. Sets sent_at."""
        draft = await self.get_draft(draft_id)
        if not draft:
            return None

        issue_number = draft.issue_number or await self._next_issue_number()
        slug = f"issue-{issue_number:03d}"
        sent_at = _now_iso()
        title = (draft.title or "").strip() or self._derive_title(draft.sections)

        issue = SentIssue(
            id=_new_issue_id(),
            issue_number=issue_number,
            slug=slug,
            title=title,
            kicker=draft.kicker,
            ship_date=draft.ship_date,
            hero_image_path=draft.hero_image_path,
            hero_caption=draft.hero_caption,
            sections=draft.sections,
            footer_cta=draft.footer_cta,
            pdf_path=None,
            html_path=None,
            sent_at=sent_at,
            recipient_count=recipient_count,
        )

        # Generate + persist export artifacts (PDF, HTML). Resilient: a failure
        # here must not block the send — the issue still moves to the archive.
        try:
            pdf_path, html_path = await self._generate_exports(issue)
            issue.pdf_path = pdf_path
            issue.html_path = html_path
        except Exception as exc:  # noqa: BLE001
            logger.warning("Export generation failed for %s: %s", slug, exc)

        storage = get_storage()
        await storage.put(ISSUES_TABLE, issue.id, _issue_to_row(issue))
        await storage.delete(DRAFTS_TABLE, draft_id)

        # Harvest the shipped sections into the voice corpus (spec §5.4).
        try:
            await self._harvest_voice_examples(issue)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Voice corpus harvest failed for %s: %s", slug, exc)

        return issue

    async def render_draft_preview(self, draft_id: str) -> Optional[str]:
        """Build the email HTML for an in-progress draft, for the composer Preview.

        Reuses the email export builder so the preview matches the shipped
        artifact exactly. The issue number shown is the one this draft would be
        assigned on send (its own, or the next sequential).
        """
        from app.services.newsletter.exports import build_email_html

        draft = await self.get_draft(draft_id)
        if not draft:
            return None
        issue_number = draft.issue_number or await self._next_issue_number()
        preview = SentIssue(
            id=draft.id,
            issue_number=issue_number,
            slug=f"issue-{issue_number:03d}",
            title=(draft.title or "").strip() or self._derive_title(draft.sections),
            kicker=draft.kicker,
            ship_date=draft.ship_date,
            hero_image_path=draft.hero_image_path,
            hero_caption=draft.hero_caption,
            sections=draft.sections,
            footer_cta=draft.footer_cta,
            pdf_path=None,
            html_path=None,
            sent_at=_now_iso(),
            recipient_count=None,
        )
        image, mime = await self._resolve_spotlight_image(draft.sections)
        hero, hero_mime = await self._resolve_hero_image(draft.hero_image_path)
        spotlight_title = await self._resolve_spotlight_title(draft.sections)
        return build_email_html(
            preview,
            spotlight_image=image,
            spotlight_image_mime=mime,
            hero_image=hero,
            hero_image_mime=hero_mime,
            booking_url=self._booking_url(),
            spotlight_title=spotlight_title,
        )

    async def _resolve_spotlight_image(
        self, sections: IssueSections
    ) -> tuple[Optional[bytes], str]:
        """Load the selected POV's screenshot bytes + MIME, if any. Best-effort."""
        pov_id = sections.use_case_spotlight.pov_id
        if not pov_id:
            return None, "image/png"
        from app.services.pov_library import pov_library_service

        try:
            pov = await pov_library_service.get_pov(pov_id)
            if pov and pov.demo_screenshot_path:
                data = await get_storage().get_file(pov.demo_screenshot_path)
                ext = pov.demo_screenshot_path.rsplit(".", 1)[-1].lower()
                mime = {
                    "png": "image/png",
                    "jpg": "image/jpeg",
                    "jpeg": "image/jpeg",
                    "webp": "image/webp",
                    "gif": "image/gif",
                }.get(ext, "image/png")
                return data, mime
        except Exception as exc:  # noqa: BLE001
            logger.info("Spotlight image unavailable: %s", exc)
        return None, "image/png"

    async def _resolve_spotlight_title(self, sections: IssueSections) -> Optional[str]:
        """The selected POV's name, for the spotlight headline. Best-effort."""
        pov_id = sections.use_case_spotlight.pov_id
        if not pov_id:
            return None
        from app.services.pov_library import pov_library_service

        try:
            pov = await pov_library_service.get_pov(pov_id)
            if pov and pov.name:
                return pov.name
        except Exception as exc:  # noqa: BLE001
            logger.info("Spotlight title unavailable: %s", exc)
        return None

    async def _resolve_hero_image(
        self, hero_image_path: Optional[str]
    ) -> tuple[Optional[bytes], str]:
        """Load the hero image bytes + MIME from storage, if any. Best-effort."""
        if not hero_image_path:
            return None, "image/jpeg"
        try:
            data = await get_storage().get_file(hero_image_path)
            ext = hero_image_path.rsplit(".", 1)[-1].lower()
            mime = {
                "png": "image/png",
                "jpg": "image/jpeg",
                "jpeg": "image/jpeg",
                "webp": "image/webp",
                "gif": "image/gif",
            }.get(ext, "image/jpeg")
            return data, mime
        except Exception as exc:  # noqa: BLE001 — a missing hero must not break render
            logger.info("Hero image unavailable: %s", exc)
        return None, "image/jpeg"

    @staticmethod
    def _booking_url() -> str:
        """The one-time-configured booking URL from user settings; default '#'."""
        try:
            from app.services.llm import get_user_settings

            return (get_user_settings().get("booking_url") or "").strip() or "#"
        except Exception:  # noqa: BLE001 — settings read must never break a render
            return "#"

    async def set_hero_image(
        self, draft_id: str, data: bytes, filename: str
    ) -> Optional[IssueDraft]:
        """Persist an uploaded hero image and update the draft's hero_image_path.

        Drafts have no slug yet, so the storage key is keyed by draft id under
        hero_images/{draft_id}.{ext} (deviation from the spec's issues/{slug}/ path).
        """
        draft = await self.get_draft(draft_id)
        if not draft:
            return None
        ext = (filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg")
        if ext not in {"jpg", "jpeg", "png"}:
            ext = "jpg"
        rel = f"hero_images/{draft_id}.{ext}"
        storage = get_storage()
        await storage.store_file(rel, data)
        draft.hero_image_path = rel
        draft.updated_at = _now_iso()
        await storage.put(DRAFTS_TABLE, draft_id, _draft_to_row(draft))
        return draft

    async def _generate_exports(self, issue: SentIssue) -> tuple[str, str]:
        """Build the PDF + email HTML, persist them, return their storage paths."""
        # Imported lazily to keep module import order simple and side-effect free.
        from app.services.newsletter.exports import build_email_html, build_pdf

        spotlight_image, mime = await self._resolve_spotlight_image(issue.sections)
        hero_image, hero_mime = await self._resolve_hero_image(issue.hero_image_path)
        spotlight_title = await self._resolve_spotlight_title(issue.sections)

        month = issue.sent_at[:7] if len(issue.sent_at) >= 7 else "unknown"
        base = f"issues/{month}/{issue.slug}"
        pdf_rel = f"{base}/{issue.slug}.pdf"
        html_rel = f"{base}/{issue.slug}.html"

        html = build_email_html(
            issue,
            spotlight_image=spotlight_image,
            spotlight_image_mime=mime,
            hero_image=hero_image,
            hero_image_mime=hero_mime,
            booking_url=self._booking_url(),
            spotlight_title=spotlight_title,
        )
        storage = get_storage()
        await storage.store_file(pdf_rel, build_pdf(issue, spotlight_image))
        await storage.store_file(html_rel, html.encode("utf-8"))
        return pdf_rel, html_rel

    async def _harvest_voice_examples(self, issue: SentIssue) -> None:
        """Write each non-empty shipped section into the voice corpus."""
        from app.services.newsletter.voice import voice_service

        s = issue.sections
        section_text: dict[str, str] = {
            "the_read": s.the_read.content.strip(),
            "whats_moving": "\n".join(
                i.line.strip() for i in s.whats_moving.items if i.line and i.line.strip()
            ),
            "use_case_spotlight": s.use_case_spotlight.content.strip(),
            "wins": "\n".join(w.strip() for w in s.wins.items if w and w.strip()),
            "horizon": "\n".join(h.strip() for h in s.horizon.items if h and h.strip()),
        }
        source = f"Issue {issue.issue_number:03d}"
        for section_type in _HARVEST_SECTIONS:
            text = section_text.get(section_type, "")
            if text:
                await voice_service.add_published_example(section_type, text, source=source)

    async def list_issues(self) -> list[SentIssue]:
        """All sent issues, newest first by sent_at."""
        storage = get_storage()
        rows = await storage.list(ISSUES_TABLE)
        issues = [_issue_from_row(r) for r in rows]
        issues.sort(key=lambda i: i.sent_at, reverse=True)
        return issues

    async def get_issue(self, issue_id: str) -> Optional[SentIssue]:
        storage = get_storage()
        row = await storage.get(ISSUES_TABLE, issue_id)
        return _issue_from_row(row) if row else None

    async def _next_issue_number(self) -> int:
        """Returns next sequential issue number across all sent issues."""
        issues = await self.list_issues()
        if not issues:
            return 1
        return max(i.issue_number for i in issues) + 1

    def _derive_title(self, sections: IssueSections) -> str:
        """Derive issue title from The Read first sentence, fallback to placeholder."""
        the_read = (sections.the_read.content or "").strip()
        if not the_read:
            return "Untitled Issue"
        # First sentence boundary if it lands within a reasonable length.
        period = the_read.find(".")
        if 0 < period < 80:
            return the_read[:period].strip()
        if len(the_read) <= 60:
            return the_read
        return the_read[:60].strip() + "..."


# Module-level singleton — stateless, safe to share.
composer_service = ComposerService()
