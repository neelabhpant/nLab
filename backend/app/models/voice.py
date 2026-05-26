"""Pydantic models for the voice corpus."""

from typing import Literal, Optional

from pydantic import BaseModel

SectionType = Literal["the_read", "whats_moving", "use_case_spotlight", "wins", "horizon"]
SECTION_TYPES: tuple[SectionType, ...] = (
    "the_read",
    "whats_moving",
    "use_case_spotlight",
    "wins",
    "horizon",
)


class VoiceExampleBase(BaseModel):
    section_type: SectionType
    example_text: str
    source: Optional[str] = None
    notes: Optional[str] = None


class VoiceExampleCreate(VoiceExampleBase):
    pass


class VoiceExampleUpdate(BaseModel):
    section_type: Optional[SectionType] = None
    example_text: Optional[str] = None
    source: Optional[str] = None
    notes: Optional[str] = None


class VoiceExample(VoiceExampleBase):
    id: str
    created_at: str
    from_published_issue: bool = False


class VoiceViolation(BaseModel):
    rule: int
    problematic_text: str
    suggestion: str


class VoiceCheckResult(BaseModel):
    violations: list[VoiceViolation]
