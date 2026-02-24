import asyncio
import json
import logging
from collections.abc import AsyncGenerator

from app.services.crew import build_crew

logger = logging.getLogger(__name__)


async def stream_crew_response(
    messages: list[dict[str, str]],
) -> AsyncGenerator[str, None]:
    """Stream a CrewAI crew response as SSE events.

    Accepts a list of message dicts with 'role' and 'content' keys.
    Extracts the latest user message, builds a crew, and streams the result.
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

        yield f"data: {json.dumps({'type': 'text', 'content': response_text})}\n\n"

    except Exception as e:
        logger.exception("Crew execution failed")
        error_msg = f"I encountered an error processing your request: {str(e)}"
        yield f"data: {json.dumps({'type': 'error', 'content': error_msg})}\n\n"

    yield "data: [DONE]\n\n"
