"""ComposerService — CRUD + draft→sent workflow for The Retail Read.

All persistence goes through the storage abstraction (see services/storage/).
The `newsletter_drafts` and `newsletter_issues` tables (spec §3.2) keep a few
typed columns plus a `content_json` blob holding the section payload + footer.
This service bundles/unbundles between Pydantic models and that storage shape.
"""

from __future__ import annotations

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


DRAFTS_TABLE = "newsletter_drafts"
ISSUES_TABLE = "newsletter_issues"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return f"draft-{uuid.uuid4().hex[:12]}"


def _new_issue_id() -> str:
    return f"issue-{uuid.uuid4().hex[:12]}"


def _bundle_content(sections: IssueSections, footer_cta: str) -> dict:
    """Bundle the section payload into the `content_json` blob shape."""
    return {
        "sections": sections.model_dump(),
        "footer_cta": footer_cta,
    }


def _unbundle_content(content: object) -> tuple[IssueSections, str]:
    """Reverse of _bundle_content. Tolerant of missing/legacy fields."""
    if not isinstance(content, dict):
        return IssueSections(), ""
    sections_data = content.get("sections") or {}
    sections = IssueSections(**sections_data) if isinstance(sections_data, dict) else IssueSections()
    footer = content.get("footer_cta") or ""
    return sections, footer


def _draft_to_row(draft: IssueDraft) -> dict:
    return {
        "id": draft.id,
        "issue_number": draft.issue_number,
        "status": draft.status,
        "content_json": _bundle_content(draft.sections, draft.footer_cta),
        "created_at": draft.created_at,
        "updated_at": draft.updated_at,
        "sent_at": draft.sent_at,
    }


def _draft_from_row(row: dict) -> IssueDraft:
    sections, footer = _unbundle_content(row.get("content_json"))
    return IssueDraft(
        id=row["id"],
        issue_number=row.get("issue_number"),
        status=row.get("status") or "draft",
        sections=sections,
        footer_cta=footer,
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
        "content_json": _bundle_content(issue.sections, issue.footer_cta),
        "pdf_path": issue.pdf_path,
        "html_path": issue.html_path,
        "sent_at": issue.sent_at,
        "recipient_count": issue.recipient_count,
    }


def _issue_from_row(row: dict) -> SentIssue:
    sections, footer = _unbundle_content(row.get("content_json"))
    return SentIssue(
        id=row["id"],
        issue_number=row["issue_number"],
        slug=row["slug"],
        title=row["title"],
        sections=sections,
        footer_cta=footer,
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
        title = self._derive_title(draft.sections)

        issue = SentIssue(
            id=_new_issue_id(),
            issue_number=issue_number,
            slug=slug,
            title=title,
            sections=draft.sections,
            footer_cta=draft.footer_cta,
            pdf_path=None,
            html_path=None,
            sent_at=sent_at,
            recipient_count=recipient_count,
        )

        storage = get_storage()
        await storage.put(ISSUES_TABLE, issue.id, _issue_to_row(issue))
        await storage.delete(DRAFTS_TABLE, draft_id)
        return issue

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
