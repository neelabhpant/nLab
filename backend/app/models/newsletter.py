"""Pydantic models for the Newsletter Composer.

See NEWSLETTER_COMPOSER_SPEC.md §4 (newsletter structure), §7.4 (state model),
and §3.2 (storage schema). Field names use snake_case end-to-end; the frontend
mirrors these names directly.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


# ---------- Section payloads ----------


class TheReadSection(BaseModel):
    """Section 1 — Neelabh's opinion. ~100 words."""

    content: str = ""
    topic_seed: Optional[str] = None
    angle: Optional[str] = None  # article_id or freeform text


class WhatsMovingItem(BaseModel):
    """One bullet in the What's Moving section."""

    article_id: Optional[str] = None  # nullable for manual entries
    line: str = ""


class WhatsMovingSection(BaseModel):
    """Section 2 — 4 bullets, account-relevant takes."""

    items: list[WhatsMovingItem] = Field(default_factory=list)


class UseCaseSpotlightSection(BaseModel):
    """Section 3 — one POV spotlight, ~200 words."""

    pov_id: Optional[str] = None
    content: str = ""
    tailored_for_account: Optional[str] = None


class BulletSection(BaseModel):
    """Generic 3-bullet section (Wins, Horizon)."""

    items: list[str] = Field(default_factory=list)


class IssueSections(BaseModel):
    """Full payload of all 5 sections."""

    the_read: TheReadSection = Field(default_factory=TheReadSection)
    whats_moving: WhatsMovingSection = Field(default_factory=WhatsMovingSection)
    use_case_spotlight: UseCaseSpotlightSection = Field(default_factory=UseCaseSpotlightSection)
    wins: BulletSection = Field(default_factory=BulletSection)
    horizon: BulletSection = Field(default_factory=BulletSection)


# ---------- Draft + Sent Issue ----------


class IssueDraftBase(BaseModel):
    issue_number: Optional[int] = None  # assigned at send-time
    title: Optional[str] = None  # editorial headline; falls back to derived if empty
    sections: IssueSections = Field(default_factory=IssueSections)
    footer_cta: str = ""


class IssueDraftCreate(IssueDraftBase):
    """Inbound shape for POST /newsletter/drafts."""


class IssueDraftUpdate(BaseModel):
    """Partial update. Auto-save sends one of these per debounce tick."""

    title: Optional[str] = None
    sections: Optional[IssueSections] = None
    footer_cta: Optional[str] = None


class IssueDraft(IssueDraftBase):
    """Full draft record."""

    id: str
    status: Literal["draft", "sent"] = "draft"
    created_at: str
    updated_at: str
    sent_at: Optional[str] = None


class UsageInfo(BaseModel):
    """Per-call token usage + estimated cost, for the composer cost display."""

    model: str
    model_label: str
    input_tokens: int
    output_tokens: int
    cost_usd: float


class SentIssue(BaseModel):
    """A draft that has been marked as sent. Lives in newsletter_issues."""

    id: str
    issue_number: int
    slug: str  # e.g. "issue-001"
    title: str  # derived from The Read or set explicitly
    sections: IssueSections
    footer_cta: str
    pdf_path: Optional[str] = None
    html_path: Optional[str] = None
    sent_at: str
    recipient_count: Optional[int] = None
