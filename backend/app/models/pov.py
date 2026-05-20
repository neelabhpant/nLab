"""Pydantic models for the POV (Point of View) Library.

See NEWSLETTER_COMPOSER_SPEC.md §6 for the schema and intent.
"""

from typing import Optional

from pydantic import BaseModel, Field


class POVBase(BaseModel):
    """Fields shared by create / read / update payloads."""

    name: str
    one_liner: str
    problem_statement: str
    architecture: str
    why_cloudera: str
    target_accounts: list[str] = Field(default_factory=list)
    target_persona: str
    ae_hook: str
    demo_screenshot_path: Optional[str] = None
    demo_link: Optional[str] = None
    tags: list[str] = Field(default_factory=list)


class POVCreate(POVBase):
    """Inbound shape for POST /pov-library."""


class POVUpdate(BaseModel):
    """Partial update. Every field optional. Caller supplies only what changes."""

    name: Optional[str] = None
    one_liner: Optional[str] = None
    problem_statement: Optional[str] = None
    architecture: Optional[str] = None
    why_cloudera: Optional[str] = None
    target_accounts: Optional[list[str]] = None
    target_persona: Optional[str] = None
    ae_hook: Optional[str] = None
    demo_screenshot_path: Optional[str] = None
    demo_link: Optional[str] = None
    tags: Optional[list[str]] = None


class POV(POVBase):
    """Outbound shape: base + id + timestamps."""

    id: str
    created_at: str
    updated_at: str
