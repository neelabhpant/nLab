import asyncio
import json
import logging
import re
from collections.abc import AsyncGenerator

from app.services.crew import build_crew

logger = logging.getLogger(__name__)

CHUNK_SIZE = 4
CHUNK_DELAY = 0.025


def _split_into_chunks(text: str, size: int = CHUNK_SIZE) -> list[str]:
    """Split text into word-based chunks preserving whitespace."""
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


async def stream_crew_response(
    messages: list[dict[str, str]],
) -> AsyncGenerator[str, None]:
    """Stream a CrewAI crew response as SSE events.

    Accepts a list of message dicts with 'role' and 'content' keys.
    Extracts the latest user message, builds a crew, and streams the result
    as incremental text_delta events for a token-by-token appearance.
    """
    user_message = ""
    for msg in reversed(messages):
        if msg.get("role") == "user":
            user_message = msg.get("content", "")
            break

    if not user_message:
        yield f"data: {json.dumps({'type': 'error', 'content': 'No user message provided'})}\n\n"
        yield "data: [DONE]\n\n"
        return

    yield f"data: {json.dumps({'type': 'thinking', 'content': 'Assembling crew and analyzing your request...'})}\n\n"

    try:
        crew = build_crew(user_message)

        yield f"data: {json.dumps({'type': 'thinking', 'content': f'Dispatching to {len(crew.agents)} agent(s)...'})}\n\n"

        result = await asyncio.to_thread(crew.kickoff)

        response_text = str(result)

        chunks = _split_into_chunks(response_text, CHUNK_SIZE)
        for chunk in chunks:
            yield f"data: {json.dumps({'type': 'text_delta', 'content': chunk})}\n\n"
            await asyncio.sleep(CHUNK_DELAY)

        yield f"data: {json.dumps({'type': 'text_done'})}\n\n"

    except Exception as e:
        logger.exception("Crew execution failed")
        error_msg = f"I encountered an error processing your request: {str(e)}"
        yield f"data: {json.dumps({'type': 'error', 'content': error_msg})}\n\n"

    yield "data: [DONE]\n\n"
