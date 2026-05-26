"""Newsletter Composer REST endpoints. See NEWSLETTER_COMPOSER_SPEC.md §7, §9."""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.models.newsletter import (
    IssueDraft,
    IssueDraftCreate,
    IssueDraftUpdate,
    SentIssue,
)
from app.models.voice import (
    SECTION_TYPES,
    SectionType,
    VoiceCheckResult,
    VoiceExample,
    VoiceExampleCreate,
    VoiceExampleUpdate,
)
from app.services.newsletter.composer import composer_service
from app.services.newsletter.exports import build_slack_text
from app.services.newsletter.generation import (
    AnthropicNotConfigured,
    GenerationTimeout,
    generation_service,
)
from app.services.newsletter.voice import voice_service
from app.services.storage import get_storage


logger = logging.getLogger(__name__)


router = APIRouter(prefix="/newsletter", tags=["newsletter"])


class SendDraftBody(BaseModel):
    recipient_count: Optional[int] = None


# ---------- Generation request shapes ----------


class GenerateTheReadBody(BaseModel):
    user_input: str = ""
    issue_number: Optional[int] = None


class GenerateWhatsMovingBody(BaseModel):
    user_input: str = ""
    issue_number: Optional[int] = None


class GenerateSpotlightBody(BaseModel):
    pov_id: str
    user_input: Optional[str] = None
    tailored_for_account: Optional[str] = None


class PolishBody(BaseModel):
    user_input: str
    section_type: Optional[SectionType] = None


class VoiceCheckBody(BaseModel):
    text: str


class GenerationResponse(BaseModel):
    content: str


def _llm_error(exc: Exception) -> HTTPException:
    """Translate LLM exceptions into HTTP responses with clear messages."""
    if isinstance(exc, AnthropicNotConfigured):
        return HTTPException(status_code=500, detail=str(exc))
    if isinstance(exc, GenerationTimeout):
        return HTTPException(status_code=504, detail=str(exc))
    logger.exception("newsletter generation failed")
    return HTTPException(status_code=500, detail=f"LLM error: {exc}")


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


# ---------- Exports (spec §8) ----------


async def _serve_stored_file(rel_path: Optional[str], media_type: str, download_name: str) -> FileResponse:
    if not rel_path:
        raise HTTPException(status_code=404, detail="Export not found")
    storage = get_storage()
    try:
        local_path = await storage.file_url(rel_path)
    except (ValueError, FileNotFoundError):
        raise HTTPException(status_code=404, detail="Export not found")
    if not Path(local_path).exists():
        raise HTTPException(status_code=404, detail="Export not found")
    return FileResponse(path=local_path, media_type=media_type, filename=download_name)


@router.get("/issues/{issue_id}/pdf")
async def download_issue_pdf(issue_id: str) -> FileResponse:
    issue = await composer_service.get_issue(issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    return await _serve_stored_file(issue.pdf_path, "application/pdf", f"{issue.slug}.pdf")


@router.get("/issues/{issue_id}/html")
async def download_issue_html(issue_id: str) -> FileResponse:
    issue = await composer_service.get_issue(issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    return await _serve_stored_file(issue.html_path, "text/html", f"{issue.slug}.html")


@router.get("/issues/{issue_id}/slack", response_model=GenerationResponse)
async def get_issue_slack(issue_id: str) -> GenerationResponse:
    """Slack-formatted text, generated on demand from the issue's sections."""
    issue = await composer_service.get_issue(issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    return GenerationResponse(content=build_slack_text(issue))


# ---------- Generation ----------


@router.post("/generate/the-read", response_model=GenerationResponse)
async def generate_the_read(body: GenerateTheReadBody) -> GenerationResponse:
    start = time.perf_counter()
    try:
        content = await generation_service.generate_the_read(body.user_input, body.issue_number)
    except Exception as exc:
        raise _llm_error(exc) from exc
    logger.info("newsletter.endpoint=the-read latency_ms=%d", int((time.perf_counter() - start) * 1000))
    return GenerationResponse(content=content)


@router.post("/generate/whats-moving", response_model=GenerationResponse)
async def generate_whats_moving(body: GenerateWhatsMovingBody) -> GenerationResponse:
    start = time.perf_counter()
    try:
        content = await generation_service.generate_whats_moving(body.user_input, body.issue_number)
    except Exception as exc:
        raise _llm_error(exc) from exc
    logger.info("newsletter.endpoint=whats-moving latency_ms=%d", int((time.perf_counter() - start) * 1000))
    return GenerationResponse(content=content)


@router.post("/generate/use-case-spotlight", response_model=GenerationResponse)
async def generate_use_case_spotlight(body: GenerateSpotlightBody) -> GenerationResponse:
    start = time.perf_counter()
    try:
        content = await generation_service.generate_use_case_spotlight(
            pov_id=body.pov_id,
            user_input=body.user_input,
            tailored_for_account=body.tailored_for_account,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise _llm_error(exc) from exc
    logger.info("newsletter.endpoint=spotlight latency_ms=%d", int((time.perf_counter() - start) * 1000))
    return GenerationResponse(content=content)


@router.post("/polish", response_model=GenerationResponse)
async def polish(body: PolishBody) -> GenerationResponse:
    start = time.perf_counter()
    try:
        content = await generation_service.polish_in_voice(body.user_input, body.section_type)
    except Exception as exc:
        raise _llm_error(exc) from exc
    logger.info("newsletter.endpoint=polish latency_ms=%d", int((time.perf_counter() - start) * 1000))
    return GenerationResponse(content=content)


@router.post("/voice-check", response_model=VoiceCheckResult)
async def voice_check(body: VoiceCheckBody) -> VoiceCheckResult:
    start = time.perf_counter()
    try:
        result = await generation_service.voice_check(body.text)
    except Exception as exc:
        raise _llm_error(exc) from exc
    logger.info("newsletter.endpoint=voice-check latency_ms=%d", int((time.perf_counter() - start) * 1000))
    return VoiceCheckResult(**result)


# ---------- Voice corpus CRUD ----------


@router.get("/voice-examples", response_model=list[VoiceExample])
async def list_voice_examples(section_type: Optional[SectionType] = None) -> list[VoiceExample]:
    return await voice_service.list_examples(section_type=section_type)


@router.post("/voice-examples", response_model=VoiceExample, status_code=201)
async def add_voice_example(body: VoiceExampleCreate) -> VoiceExample:
    if body.section_type not in SECTION_TYPES:
        raise HTTPException(status_code=400, detail=f"Unknown section_type: {body.section_type}")
    return await voice_service.add_example(body)


@router.put("/voice-examples/{example_id}", response_model=VoiceExample)
async def update_voice_example(example_id: str, body: VoiceExampleUpdate) -> VoiceExample:
    updated = await voice_service.update_example(example_id, body)
    if not updated:
        raise HTTPException(status_code=404, detail="Voice example not found")
    return updated


@router.delete("/voice-examples/{example_id}", status_code=204)
async def delete_voice_example(example_id: str) -> None:
    if not await voice_service.delete_example(example_id):
        raise HTTPException(status_code=404, detail="Voice example not found")
