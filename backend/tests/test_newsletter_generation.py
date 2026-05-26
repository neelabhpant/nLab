"""Unit tests for the newsletter generation pipeline.

The Anthropic API is never actually called — we monkeypatch the LLM client's
generate() and voice_check() methods to return canned responses.
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pytest

from app.models.voice import VoiceExampleCreate
from app.services import storage as storage_module
from app.services.newsletter import generation as generation_module
from app.services.newsletter import llm_client as llm_client_module
from app.services.newsletter import voice as voice_module
from app.services.newsletter.generation import GenerationService
from app.services.newsletter.llm_client import NewsletterLLMClient
from app.services.newsletter.voice import VoiceService
from app.services.storage.local import LocalStorageBackend


@pytest.fixture
def isolated_storage(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> LocalStorageBackend:
    backend = LocalStorageBackend(storage_root=tmp_path)
    monkeypatch.setattr(storage_module, "_backend", backend, raising=False)
    monkeypatch.setattr(storage_module, "get_storage", lambda: backend)
    monkeypatch.setattr(voice_module, "get_storage", lambda: backend)
    return backend


def _fake_usage():
    from app.models.newsletter import UsageInfo

    return UsageInfo(
        model="claude-sonnet-4-6",
        model_label="Sonnet 4.6",
        input_tokens=100,
        output_tokens=50,
        cost_usd=0.001,
    )


class FakeLLM(NewsletterLLMClient):
    """Stand-in client that records prompts and returns canned outputs."""

    def __init__(self, generate_text: str = "fake content", voice_payload: Any = None) -> None:
        self.generate_text = generate_text
        self.voice_payload = voice_payload or {"violations": []}
        self.generate_prompts: list[str] = []
        self.voice_inputs: list[str] = []

    async def generate(self, prompt: str):  # type: ignore[override]
        self.generate_prompts.append(prompt)
        return self.generate_text, _fake_usage()

    async def voice_check(self, text: str, prompt_template: str):  # type: ignore[override]
        self.voice_inputs.append(text)
        return self.voice_payload, _fake_usage()


# ---------- Voice service ----------


@pytest.mark.asyncio
async def test_voice_seed_idempotent(isolated_storage: LocalStorageBackend, tmp_path: Path) -> None:
    service = VoiceService()
    seed = tmp_path / "voice_seed.json"
    now = datetime.now(timezone.utc).isoformat()
    seed.write_text(json.dumps([
        {
            "id": "voice-the-read-fixture",
            "section_type": "the_read",
            "example_text": "Sample.",
            "source": "fixture",
            "notes": None,
            "created_at": now,
        }
    ]))
    first = await service.seed_from_file(seed)
    assert first == 1
    second = await service.seed_from_file(seed)
    assert second == 0
    rows = await service.list_examples()
    assert len(rows) == 1


@pytest.mark.asyncio
async def test_get_few_shot_examples_returns_strings(isolated_storage: LocalStorageBackend) -> None:
    service = VoiceService()
    for i in range(3):
        await service.add_example(
            VoiceExampleCreate(
                section_type="the_read",
                example_text=f"example {i}",
                source="test",
                notes=None,
            )
        )
    examples = await service.get_few_shot_examples("the_read", limit=5)
    assert isinstance(examples, list)
    assert all(isinstance(e, str) for e in examples)
    assert len(examples) == 3


@pytest.mark.asyncio
async def test_voice_examples_section_filter(isolated_storage: LocalStorageBackend) -> None:
    service = VoiceService()
    await service.add_example(
        VoiceExampleCreate(section_type="the_read", example_text="A")
    )
    await service.add_example(
        VoiceExampleCreate(section_type="wins", example_text="B")
    )
    only_wins = await service.get_few_shot_examples("wins", limit=10)
    assert only_wins == ["B"]


# ---------- Generation orchestration ----------


@pytest.mark.asyncio
async def test_prompt_substitution_includes_voice_rules_and_examples(
    isolated_storage: LocalStorageBackend,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = VoiceService()
    await service.add_example(
        VoiceExampleCreate(section_type="the_read", example_text="EX-ALPHA")
    )

    fake = FakeLLM(generate_text="output")
    monkeypatch.setattr(generation_module, "newsletter_llm_client", fake)
    monkeypatch.setattr(generation_module, "voice_service", service)

    gen = GenerationService()
    out, _usage = await gen.generate_the_read(user_input="Topic seed: data unification.", issue_number=7)
    assert out == "output"
    assert len(fake.generate_prompts) == 1
    prompt = fake.generate_prompts[0]
    # Voice rules + few-shot + user input all substituted in.
    assert "NO em-dashes" in prompt
    assert "EX-ALPHA" in prompt
    assert "Topic seed: data unification." in prompt
    # Issue number gets stamped where the placeholder lived.
    assert "Issue 7" in prompt


@pytest.mark.asyncio
async def test_voice_check_parses_clean_text(
    isolated_storage: LocalStorageBackend,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = FakeLLM(voice_payload={"violations": []})
    monkeypatch.setattr(generation_module, "newsletter_llm_client", fake)
    gen = GenerationService()
    result, _usage = await gen.voice_check("Clean prose with no issues.")
    assert result == {"violations": []}
    assert fake.voice_inputs == ["Clean prose with no issues."]


@pytest.mark.asyncio
async def test_voice_check_catches_em_dash(
    isolated_storage: LocalStorageBackend,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = FakeLLM(
        voice_payload={
            "violations": [
                {
                    "rule": 1,
                    "problematic_text": "data — and intent",
                    "suggestion": "data, and intent",
                }
            ]
        }
    )
    monkeypatch.setattr(generation_module, "newsletter_llm_client", fake)
    gen = GenerationService()
    result, _usage = await gen.voice_check("Retailers blend data — and intent — into agents.")
    assert len(result["violations"]) == 1
    assert result["violations"][0]["rule"] == 1


@pytest.mark.asyncio
async def test_voice_check_empty_text_short_circuits(
    isolated_storage: LocalStorageBackend,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = FakeLLM(voice_payload={"violations": [{"rule": 1, "problematic_text": "x", "suggestion": "y"}]})
    monkeypatch.setattr(generation_module, "newsletter_llm_client", fake)
    gen = GenerationService()
    result, _usage = await gen.voice_check("   \n  ")
    assert result == {"violations": []}
    # Should not have called the LLM at all.
    assert fake.voice_inputs == []


# ---------- llm_client JSON resilience ----------


def test_safe_json_load_strips_code_fences() -> None:
    raw = "```json\n{\"violations\": []}\n```"
    out = llm_client_module._safe_json_load(raw)
    assert out == {"violations": []}


def test_safe_json_load_handles_extra_prose() -> None:
    raw = 'Sure, here is the JSON:\n{"violations": [{"rule": 1, "problematic_text": "a", "suggestion": "b"}]}\nLet me know if that helps.'
    out = llm_client_module._safe_json_load(raw)
    assert out["violations"][0]["rule"] == 1


def test_safe_json_load_returns_empty_on_garbage() -> None:
    raw = "totally unparseable"
    out = llm_client_module._safe_json_load(raw)
    assert out == {"violations": []}
