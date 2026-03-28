"""Retail RAG chat — conversational search over retail knowledge base."""

import asyncio
import json
import logging
import re
from collections.abc import AsyncGenerator
from typing import Any

from app.services.retail_memory import RetailMemory
from app.services.retail_summarizer import (
    get_retail_llm_settings,
    _retail_litellm_model,
)

logger = logging.getLogger(__name__)

CHUNK_SIZE = 4
CHUNK_DELAY = 0.025

SYSTEM_PROMPT_TEMPLATE = """You are a retail AI strategy advisor. You have access to a knowledge base of retail industry articles, trends, and AI use case analyses.

Your user is a Director of AI Industry Solutions for Retail at Cloudera. They have deep ML/AI expertise and need strategic insights, not basic explanations.

Retrieved context from the retail intelligence knowledge base:

{context}

When answering:
- Reference specific articles and sources when relevant
- Connect retail trends to Cloudera data platform capabilities (NiFi, Kafka, Spark, Iceberg, CML, Agent Studio, RAG Studio, Data Warehouse)
- Think about practical use case opportunities
- Be direct and strategic, not academic
- If context doesn't contain relevant info, say so and offer general insight"""

_NO_TEMPERATURE_MODELS = {"gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-5.2"}




def _call_llm(system_prompt: str, user_query: str) -> str:
    from litellm import completion

    settings = get_retail_llm_settings()
    model_string = _retail_litellm_model(settings)
    model_name = settings["model"]

    kwargs: dict[str, Any] = {
        "model": model_string,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_query},
        ],
        "api_key": settings["api_key"],
        "max_completion_tokens": 1500,
    }
    if model_name not in _NO_TEMPERATURE_MODELS:
        kwargs["temperature"] = 0.3

    response = completion(**kwargs)
    return response.choices[0].message.content


def _split_into_chunks(text: str, size: int = CHUNK_SIZE) -> list[str]:
    tokens = re.split(r'(\s+)', text)
    chunks: list[str] = []
    current = ""
    word_count = 0
    for token in tokens:
        current += token
        if token.strip():
            word_count += 1
        if word_count >= size:
            chunks.append(current)
            current = ""
            word_count = 0
    if current:
        chunks.append(current)
    return chunks


async def stream_retail_chat(
    query: str,
    memory: RetailMemory | None = None,
) -> AsyncGenerator[str, None]:
    yield f"data: {json.dumps({'type': 'thinking', 'content': 'Searching retail intelligence...'})}\n\n"

    context_parts: list[str] = []
    if memory and memory.available:
        try:
            results = await asyncio.to_thread(memory.search, query, 8)
            for i, r in enumerate(results, 1):
                text = r.get("text", "")
                title = r.get("metadata", {}).get("title", "")
                source = r.get("metadata", {}).get("source_id", "")
                if text:
                    label = f"{title} ({source})" if title else f"Result {i}"
                    context_parts.append(f"[{label}]: {text}")
        except Exception:
            logger.warning("Retail semantic search failed during chat")

    if not context_parts:
        no_data_msg = "I don't have enough retail intelligence data yet. Try fetching some sources first from the Sources page, then come back to chat."
        yield f"data: {json.dumps({'type': 'text', 'content': no_data_msg})}\n\n"
        yield "data: [DONE]\n\n"
        return

    context = "\n\n".join(context_parts)
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(context=context)

    yield f"data: {json.dumps({'type': 'thinking', 'content': f'Found {len(context_parts)} relevant sources. Analyzing...'})}\n\n"

    try:
        response_text = await asyncio.to_thread(_call_llm, system_prompt, query)
        chunks = _split_into_chunks(response_text)
        for chunk in chunks:
            yield f"data: {json.dumps({'type': 'text_delta', 'content': chunk})}\n\n"
            await asyncio.sleep(CHUNK_DELAY)
        yield f"data: {json.dumps({'type': 'text_done', 'content': ''})}\n\n"
    except Exception as e:
        logger.exception("Retail chat LLM call failed")
        yield f"data: {json.dumps({'type': 'error', 'content': f'Failed to generate response: {e}'})}\n\n"

    yield "data: [DONE]\n\n"
