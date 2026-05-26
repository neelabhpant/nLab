"""GenerationService — orchestrates prompt building + LLM calls + voice check.

Each generate_* method assembles the section prompt from a template, the voice
rules, and the few-shot corpus, then asks the LLM for content. The voice
check runs separately — the router or store decides when to call it.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

from app.models.newsletter import UsageInfo
from app.models.voice import SectionType
from app.services.newsletter.llm_client import (
    AnthropicNotConfigured,
    GenerationTimeout,
    newsletter_llm_client,
)
from app.services.newsletter.voice import voice_service
from app.services.pov_library import pov_library_service

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"

# Re-export for clean importing from the router.
__all__ = [
    "GenerationService",
    "generation_service",
    "AnthropicNotConfigured",
    "GenerationTimeout",
]


def _load_template(name: str) -> str:
    return (PROMPTS_DIR / name).read_text()


class GenerationService:
    def __init__(self) -> None:
        self.llm = newsletter_llm_client
        self.voice = voice_service
        self.pov_lib = pov_library_service
        self._voice_rules = _load_template("voice_rules.txt")
        self._voice_check_template = _load_template("voice_check.txt")

    # ---------- public surface ----------

    async def generate_the_read(
        self,
        user_input: str,
        issue_number: Optional[int] = None,
    ) -> tuple[str, UsageInfo]:
        prompt = await self._build_prompt(
            template_name="the_read.txt",
            section_type="the_read",
            user_input=user_input,
            issue_number_or_pending=str(issue_number) if issue_number else "pending",
        )
        text, usage = await self.llm.generate(prompt)
        return text.strip(), usage

    async def generate_whats_moving(
        self,
        user_input: str,
        issue_number: Optional[int] = None,
    ) -> tuple[str, UsageInfo]:
        prompt = await self._build_prompt(
            template_name="whats_moving.txt",
            section_type="whats_moving",
            user_input=user_input,
            issue_number_or_pending=str(issue_number) if issue_number else "pending",
        )
        text, usage = await self.llm.generate(prompt)
        return text.strip(), usage

    async def generate_use_case_spotlight(
        self,
        pov_id: str,
        user_input: Optional[str] = None,
        tailored_for_account: Optional[str] = None,
    ) -> tuple[str, UsageInfo]:
        pov = await self.pov_lib.get_pov(pov_id)
        if not pov:
            raise ValueError(f"POV not found: {pov_id}")
        prompt = await self._build_prompt(
            template_name="use_case_spotlight.txt",
            section_type="use_case_spotlight",
            user_input=user_input or "",
            pov_name=pov.name,
            pov_one_liner=pov.one_liner,
            pov_problem=pov.problem_statement,
            pov_architecture=pov.architecture,
            pov_why_cloudera=pov.why_cloudera,
            pov_target_accounts=", ".join(pov.target_accounts),
            pov_target_persona=pov.target_persona,
            pov_ae_hook=pov.ae_hook,
            tailored_for_account=tailored_for_account or "none",
        )
        text, usage = await self.llm.generate(prompt)
        return text.strip(), usage

    async def polish_section(self, section_type: SectionType, user_input: str) -> tuple[str, UsageInfo]:
        """Section-aware polish — wins / horizon use their own templates so the
        bullet-count constraint stays in the prompt."""
        template_name = {
            "wins": "wins.txt",
            "horizon": "horizon.txt",
            "the_read": "polish.txt",
            "whats_moving": "polish.txt",
            "use_case_spotlight": "polish.txt",
        }.get(section_type, "polish.txt")

        prompt = await self._build_prompt(
            template_name=template_name,
            section_type=section_type,
            user_input=user_input,
            # The wins / horizon templates don't use these, but the_read template might.
            issue_number_or_pending="pending",
        )
        text, usage = await self.llm.generate(prompt)
        return text.strip(), usage

    async def polish_in_voice(
        self,
        user_input: str,
        section_type: Optional[SectionType] = None,
    ) -> tuple[str, UsageInfo]:
        """Generic polish endpoint. Falls back to polish.txt when no section
        is supplied."""
        if section_type:
            return await self.polish_section(section_type, user_input)
        prompt = await self._build_prompt(
            template_name="polish.txt",
            section_type="the_read",  # any seed for few-shot; polish.txt is voice-only
            user_input=user_input,
        )
        text, usage = await self.llm.generate(prompt)
        return text.strip(), usage

    async def voice_check(self, text: str) -> tuple[dict, Optional[UsageInfo]]:
        """Return ({"violations": [...]}, usage). Usage is None when the text is
        empty (no LLM call made)."""
        if not text.strip():
            return {"violations": []}, None
        return await self.llm.voice_check(text, self._voice_check_template)

    # ---------- internals ----------

    async def _build_prompt(
        self,
        template_name: str,
        section_type: SectionType,
        **kwargs: object,
    ) -> str:
        template = _load_template(template_name)
        examples = await self.voice.get_few_shot_examples(section_type, limit=5)
        examples_block = (
            "\n\n---\n\n".join(examples)
            if examples
            else "(no seeded examples for this section yet — write in the voice rules above)"
        )
        prompt = template.replace("{VOICE_RULES}", self._voice_rules)
        prompt = prompt.replace("{FEW_SHOT_EXAMPLES}", examples_block)
        for k, v in kwargs.items():
            placeholder = "{" + k + "}"
            replacement = "" if v is None else str(v)
            prompt = prompt.replace(placeholder, replacement)
        return prompt


generation_service = GenerationService()
