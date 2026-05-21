"""Newsletter Composer REST endpoints. See NEWSLETTER_COMPOSER_SPEC.md §7, §9."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.models.newsletter import (
    IssueDraft,
    IssueDraftCreate,
    IssueDraftUpdate,
    SentIssue,
)
from app.services.newsletter.composer import composer_service


router = APIRouter(prefix="/newsletter", tags=["newsletter"])


class SendDraftBody(BaseModel):
    recipient_count: Optional[int] = None


# ---------- Drafts ----------


@router.get("/drafts", response_model=list[IssueDraft])
async def list_drafts() -> list[IssueDraft]:
    return await composer_service.list_drafts()


@router.post("/drafts", response_model=IssueDraft, status_code=201)
async def create_draft(body: Optional[IssueDraftCreate] = None) -> IssueDraft:
    payload = body or IssueDraftCreate()
    return await composer_service.create_draft(payload)


@router.get("/drafts/{draft_id}", response_model=IssueDraft)
async def get_draft(draft_id: str) -> IssueDraft:
    draft = await composer_service.get_draft(draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    return draft


@router.put("/drafts/{draft_id}", response_model=IssueDraft)
async def update_draft(draft_id: str, body: IssueDraftUpdate) -> IssueDraft:
    updated = await composer_service.update_draft(draft_id, body)
    if not updated:
        raise HTTPException(status_code=404, detail="Draft not found")
    return updated


@router.delete("/drafts/{draft_id}", status_code=204)
async def delete_draft(draft_id: str) -> None:
    deleted = await composer_service.delete_draft(draft_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Draft not found")


@router.post("/drafts/{draft_id}/send", response_model=SentIssue)
async def send_draft(draft_id: str, body: Optional[SendDraftBody] = None) -> SentIssue:
    """Mark a draft as sent. Moves the record from drafts to issues."""
    recipient_count = body.recipient_count if body else None
    issue = await composer_service.mark_sent(draft_id, recipient_count=recipient_count)
    if not issue:
        raise HTTPException(status_code=404, detail="Draft not found")
    return issue


# ---------- Issues ----------


@router.get("/issues", response_model=list[SentIssue])
async def list_issues() -> list[SentIssue]:
    return await composer_service.list_issues()


@router.get("/issues/{issue_id}", response_model=SentIssue)
async def get_issue(issue_id: str) -> SentIssue:
    issue = await composer_service.get_issue(issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    return issue
