"""Vault chat — conversational search over uploaded documents."""

import asyncio
import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

from app.services.llm import get_user_settings
from app.services.vault_memory import VaultMemory
from app.services.vault_storage import VaultStorage

logger = logging.getLogger(__name__)

SYSTEM_PROMPT_TEMPLATE = """You are a document intelligence assistant. The user has uploaded personal documents and is asking questions about them.

You have access to the following retrieved context from their document library:

{context}

Answer the user's question based ONLY on the retrieved context. If the context doesn't contain enough information to answer, say so clearly and suggest what documents the user might need to upload. Always cite which document your answer comes from when possible.
Be concise and direct. For financial questions, include specific numbers. For legal/contract questions, note important dates and terms."""


class VaultChat:
    """Chat interface for querying vault documents."""

    def __init__(self, storage: VaultStorage, memory: VaultMemory | None = None) -> None:
        self._storage = storage
        self._memory = memory

    async def chat(
        self,
        query: str,
        user_email: str,
    ) -> AsyncGenerator[str, None]:
        """Stream a response based on document context via SSE."""
        yield f"data: {json.dumps({'type': 'thinking', 'content': 'Searching your document library...'})}\n\n"

        context_parts: list[str] = []

        if self._memory and self._memory.available:
            try:
                mem_results = await asyncio.to_thread(
                    self._memory.search, query, user_email, 10
                )
                for i, mem in enumerate(mem_results, 1):
                    text = mem.get("text", mem.get("memory", ""))
                    if text:
                        title = mem.get("metadata", {}).get("title", "")
                        label = f"Document: {title}" if title else f"Memory {i}"
                        context_parts.append(f"[{label}]: {text}")
            except Exception:
                logger.warning("Semantic search failed during chat")

        try:
            sql_results = await self._storage.search_text(user_email, query, limit=5)
            for doc in sql_results:
                title = doc.get("title") or doc.get("filename", "Unknown")
                snippet = doc.get("snippet", doc.get("summary", ""))
                if snippet:
                    context_parts.append(f"[Document: {title}]: {snippet}")
        except Exception:
            logger.warning("SQLite search failed during chat")

        if not context_parts:
            no_docs_msg = "I couldn't find any relevant documents in your vault. Try uploading some documents first, or rephrase your question."
            yield f"data: {json.dumps({'type': 'text', 'content': no_docs_msg})}\n\n"
            yield "data: [DONE]\n\n"
            return

        context = "\n\n".join(context_parts)
        system_prompt = SYSTEM_PROMPT_TEMPLATE.format(context=context)

        yield f"data: {json.dumps({'type': 'thinking', 'content': f'Found {len(context_parts)} relevant sources. Generating response...'})}\n\n"

        try:
            response_text = await asyncio.to_thread(
                _call_llm_chat, system_prompt, query
            )
            yield f"data: {json.dumps({'type': 'text', 'content': response_text})}\n\n"
        except Exception as e:
            logger.exception("Vault chat LLM call failed")
            yield f"data: {json.dumps({'type': 'error', 'content': f'Failed to generate response: {e}'})}\n\n"

        yield "data: [DONE]\n\n"


_NO_TEMPERATURE_MODELS = {"gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-5.2"}


def _get_litellm_params(settings: dict) -> dict[str, str]:
    """Return model and api_key for litellm based on provider setting."""
    provider = settings["provider"]
    if provider == "anthropic":
        return {
            "model": f"anthropic/{settings.get('anthropic_model', 'claude-sonnet-4-20250514')}",
            "api_key": settings["anthropic_api_key"],
        }
    if provider == "groq":
        model_name = settings.get("groq_model", "llama-3.3-70b-versatile")
        if not model_name.startswith("groq/"):
            model_name = f"groq/{model_name}"
        return {"model": model_name, "api_key": settings["groq_api_key"]}
    model_name = settings.get("openai_model", "gpt-4o")
    return {
        "model": f"openai/{model_name}",
        "api_key": settings["openai_api_key"],
    }


def _call_llm_chat(system_prompt: str, user_query: str) -> str:
    """Call the LLM for a chat response."""
    from litellm import completion

    settings = get_user_settings()
    params = _get_litellm_params(settings)
    model_name = params["model"].split("/", 1)[-1]

    kwargs: dict[str, Any] = {
        "model": params["model"],
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_query},
        ],
        "api_key": params["api_key"],
        "max_completion_tokens": 2000,
    }
    if model_name not in _NO_TEMPERATURE_MODELS:
        kwargs["temperature"] = 0.2

    response = completion(**kwargs)
    return response.choices[0].message.content
