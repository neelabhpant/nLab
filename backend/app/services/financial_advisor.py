"""Financial advisor crew with persistent memory and document understanding."""

import asyncio
import json
import logging
from collections.abc import AsyncGenerator
from pathlib import Path

from crewai import Agent, Crew, Process, Task

from app.services.llm import get_llm
from app.services.advisor_tools import (
    AddProfileNoteTool,
    GetUserProfileTool,
    SearchDocumentsTool,
    UpdateUserProfileTool,
)
from app.services.tools import GetNewsTool
from app.services.documents import list_documents

logger = logging.getLogger(__name__)

MEMORY_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "advisor_memory"

SYSTEM_CONTEXT = (
    "You are part of a personal financial advisory team. The user trusts you "
    "with their financial life. Be thorough but concise. Always consider the "
    "user's specific situation from their profile. Never give generic advice "
    "when personalised guidance is possible. Include specific numbers and "
    "actionable steps."
)


def _build_advisor_crew(user_query: str, conversation_context: str = "") -> Crew:
    """Build a CrewAI crew for financial advising.

    Args:
        user_query: The user's current question.
        conversation_context: Previous conversation messages for context.
    """
    llm = get_llm()
    has_docs = len(list_documents()) > 0

    search_tool = SearchDocumentsTool()
    profile_tool = GetUserProfileTool()
    update_tool = UpdateUserProfileTool()
    note_tool = AddProfileNoteTool()
    news_tool = GetNewsTool()

    document_analyst = Agent(
        role="Financial Document Analyst",
        goal="Extract and interpret financial data from uploaded documents and update the user profile with findings",
        backstory=(
            f"{SYSTEM_CONTEXT} "
            "You are an expert at reading financial documents — tax returns, bank statements, "
            "pay stubs, investment statements, credit card statements. You extract precise "
            "numbers, identify patterns, and flag anything noteworthy. You always update "
            "the user profile when you find new financial data."
        ),
        tools=[search_tool, profile_tool, update_tool],
        llm=llm,
        verbose=False,
    )

    financial_planner = Agent(
        role="Personal Financial Planner",
        goal="Provide personalised financial guidance based on the user's complete financial picture",
        backstory=(
            f"{SYSTEM_CONTEXT} "
            "You are a certified financial planner who creates actionable financial plans. "
            "You consider the user's income, expenses, debts, goals, and risk tolerance "
            "to provide tailored advice. You think in terms of specific steps, timelines, "
            "and dollar amounts. You always check the user's profile first."
        ),
        tools=[profile_tool, update_tool, search_tool, note_tool],
        llm=llm,
        verbose=False,
    )

    research_agent = Agent(
        role="Financial Research Specialist",
        goal="Research current financial information relevant to the user's questions",
        backstory=(
            f"{SYSTEM_CONTEXT} "
            "You are a financial research specialist who stays current on interest rates, "
            "tax rules, market conditions, and financial product offerings. You provide "
            "factual, up-to-date information to support the advisory team's recommendations."
        ),
        tools=[news_tool],
        llm=llm,
        verbose=False,
    )

    synthesis_agent = Agent(
        role="Financial Advisor",
        goal="Translate complex financial analysis into clear, actionable advice in a warm conversational tone",
        backstory=(
            f"{SYSTEM_CONTEXT} "
            "You are the lead financial advisor who synthesises all the team's work into "
            "a clear, conversational response. You write like a trusted friend who happens "
            "to be brilliant with money — warm, direct, and specific. You always use the "
            "user's name if known. You save important notes from the conversation for "
            "future reference."
        ),
        tools=[note_tool, profile_tool],
        llm=llm,
        verbose=False,
    )

    context_block = ""
    if conversation_context:
        context_block = f"\n\nPrevious conversation context:\n{conversation_context}\n"

    tasks: list[Task] = []

    if has_docs:
        tasks.append(Task(
            description=(
                f"The user asks: {user_query}{context_block}\n\n"
                "First, check the user's profile for existing financial information. "
                "Then search their uploaded documents for any data relevant to this question. "
                "If you find new financial data, update the user's profile. "
                "Present your findings clearly with specific numbers."
            ),
            expected_output="A summary of relevant financial data from the user's documents and profile.",
            agent=document_analyst,
        ))

    tasks.append(Task(
        description=(
            f"The user asks: {user_query}{context_block}\n\n"
            "Check the user's financial profile. Based on their complete financial picture "
            "(income, expenses, debts, goals, risk tolerance), develop specific, personalised "
            "financial guidance. Include concrete numbers, timelines, and action steps. "
            "If the user hasn't shared enough information, note what additional details "
            "would help you give better advice."
        ),
        expected_output="Personalised financial guidance with specific action steps and numbers.",
        agent=financial_planner,
    ))

    tasks.append(Task(
        description=(
            f"Research any current financial information relevant to the user's question: {user_query}\n\n"
            "Look up current news, rates, or market conditions that could affect the advice. "
            "Only research what's directly relevant — don't add noise."
        ),
        expected_output="Relevant current financial information and market context.",
        agent=research_agent,
    ))

    tasks.append(Task(
        description=(
            f"Synthesise all the team's analysis into a clear, conversational response to: {user_query}{context_block}\n\n"
            "Write in a warm, friendly tone. Be specific with numbers and steps. "
            "Structure the response naturally — don't use bullet points unless listing "
            "specific action steps. If this conversation revealed important information "
            "about the user, save a note for future sessions. "
            "Do NOT include internal team references — speak directly to the user."
        ),
        expected_output="A warm, personalised financial advisory response with specific actionable guidance.",
        agent=synthesis_agent,
    ))

    agents = []
    if has_docs:
        agents.append(document_analyst)
    agents.extend([financial_planner, research_agent, synthesis_agent])

    MEMORY_DIR.mkdir(parents=True, exist_ok=True)

    return Crew(
        agents=agents,
        tasks=tasks,
        process=Process.sequential,
        verbose=False,
        memory=True,
        output_log_file=str(MEMORY_DIR / "crew_log.txt"),
    )


async def stream_advisor_response(
    messages: list[dict[str, str]],
) -> AsyncGenerator[str, None]:
    """Stream a financial advisor crew response as SSE events.

    Args:
        messages: List of message dicts with 'role' and 'content' keys.
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

    context_parts = []
    for msg in messages[:-1]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if content:
            context_parts.append(f"{role}: {content[:500]}")
    conversation_context = "\n".join(context_parts[-6:])

    yield f"data: {json.dumps({'type': 'thinking', 'content': 'Your financial advisory team is reviewing your question...'})}\n\n"

    try:
        crew = _build_advisor_crew(user_message, conversation_context)

        agent_count = len(crew.agents)
        yield f"data: {json.dumps({'type': 'thinking', 'content': f'Consulting {agent_count} specialist(s)...'})}\n\n"

        result = await asyncio.to_thread(crew.kickoff)
        response_text = str(result)

        yield f"data: {json.dumps({'type': 'text', 'content': response_text})}\n\n"

    except Exception as e:
        logger.exception("Advisor crew execution failed")
        error_msg = f"I encountered an error processing your request: {str(e)}"
        yield f"data: {json.dumps({'type': 'error', 'content': error_msg})}\n\n"

    yield "data: [DONE]\n\n"
