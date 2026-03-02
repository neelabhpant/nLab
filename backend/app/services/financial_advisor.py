"""Financial advisor crew with persistent memory, smart routing, and streaming."""

import asyncio
import json
import logging
import queue
import threading
from collections.abc import AsyncGenerator
from pathlib import Path
from typing import Literal

from crewai import Agent, Crew, Process, Task
from litellm import completion as litellm_completion

from app.services.llm import get_llm, get_user_settings
from app.services.advisor_tools import (
    AddProfileNoteTool,
    GetUserProfileTool,
    SearchDocumentsTool,
    UpdateUserProfileTool,
)
from app.services.tools import GetNewsTool
from app.services.documents import list_documents
from app.services.user_profile import get_profile_summary

logger = logging.getLogger(__name__)

MEMORY_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "advisor_memory"

SYSTEM_CONTEXT = (
    "You are part of a personal financial advisory team. The user trusts you "
    "with their financial life. Be thorough but concise. Always consider the "
    "user's specific situation from their profile. Never give generic advice "
    "when personalised guidance is possible. Include specific numbers and "
    "actionable steps."
)

QueryType = Literal["simple", "personal", "research", "full"]

AGENT_DESCRIPTIONS: dict[str, str] = {
    "Financial Document Analyst": "Searching your uploaded documents for relevant data",
    "Personal Financial Planner": "Analyzing your financial profile and building a plan",
    "Financial Research Specialist": "Researching current rates, news, and market data",
    "Financial Advisor": "Synthesizing insights into personalized advice",
}


def _classify_query(user_query: str, has_docs: bool, has_profile: bool) -> QueryType:
    """Classify the user query to determine which agents are needed."""
    settings = get_user_settings()
    provider = settings["provider"]
    if provider == "anthropic":
        model = f"anthropic/{settings['anthropic_model']}"
        api_key = settings["anthropic_api_key"]
    elif provider == "groq":
        model_name = settings["groq_model"]
        if not model_name.startswith("groq/"):
            model_name = f"groq/{model_name}"
        model = model_name
        api_key = settings["groq_api_key"]
    else:
        model = f"openai/{settings['openai_model']}"
        api_key = settings["openai_api_key"]

    prompt = (
        "Classify this financial question into exactly one category. "
        "Reply with ONLY the category word, nothing else.\n\n"
        "Categories:\n"
        "- simple: General financial knowledge, definitions, concepts, tips "
        "(e.g. 'what is a Roth IRA', 'how does compound interest work', 'budgeting tips')\n"
        "- personal: Needs the user's financial profile to answer well "
        "(e.g. 'create a savings plan for me', 'how should I pay off my debt', 'review my finances')\n"
        "- research: Needs current market data, news, rates "
        "(e.g. 'what are current mortgage rates', 'how is the market doing', 'best savings accounts right now')\n"
        "- full: Complex question needing both personal data AND current research "
        "(e.g. 'should I refinance my mortgage given current rates', 'rebalance my portfolio for this market')\n\n"
        f"Question: {user_query}\n\nCategory:"
    )

    try:
        response = litellm_completion(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            api_key=api_key,
            max_completion_tokens=10,
        )
        raw = response.choices[0].message.content.strip().lower()
        for cat in ("simple", "personal", "research", "full"):
            if cat in raw:
                result: QueryType = cat  # type: ignore[assignment]
                if result == "personal" and has_docs:
                    return "full"
                return result
    except Exception:
        logger.warning("Query classification failed, defaulting to personal")

    return "personal"


def _direct_answer(
    user_query: str, conversation_context: str = ""
) -> str:
    """Answer simple knowledge questions with a single LLM call."""
    settings = get_user_settings()
    provider = settings["provider"]
    if provider == "anthropic":
        model = f"anthropic/{settings['anthropic_model']}"
        api_key = settings["anthropic_api_key"]
    elif provider == "groq":
        model_name = settings["groq_model"]
        if not model_name.startswith("groq/"):
            model_name = f"groq/{model_name}"
        model = model_name
        api_key = settings["groq_api_key"]
    else:
        model = f"openai/{settings['openai_model']}"
        api_key = settings["openai_api_key"]

    profile_summary = get_profile_summary()

    system_msg = (
        "You are a friendly, knowledgeable financial advisor. Answer the user's question "
        "clearly and concisely. Use a warm, conversational tone. Include specific numbers "
        "and actionable steps where relevant. If you know the user's name from their profile, "
        "use it.\n\n"
        f"User's financial profile:\n{profile_summary}"
    )

    messages = [{"role": "system", "content": system_msg}]
    if conversation_context:
        messages.append({"role": "user", "content": f"Previous conversation:\n{conversation_context}"})
        messages.append({"role": "assistant", "content": "I understand the context. What's your question?"})
    messages.append({"role": "user", "content": user_query})

    response = litellm_completion(
        model=model,
        messages=messages,
        api_key=api_key,
        max_completion_tokens=1500,
    )
    return response.choices[0].message.content


def _build_advisor_crew(
    user_query: str,
    conversation_context: str = "",
    query_type: QueryType = "full",
    event_queue: queue.Queue | None = None,
) -> Crew:
    """Build a CrewAI crew for financial advising.

    Args:
        user_query: The user's current question.
        conversation_context: Previous conversation messages for context.
        query_type: Classification determining which agents to use.
        event_queue: Optional queue for streaming events.
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
    agents: list[Agent] = []

    include_docs = has_docs and query_type in ("full",)
    include_planner = query_type in ("personal", "full")
    include_research = query_type in ("research", "full")

    if include_docs:
        agents.append(document_analyst)
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

    if include_planner:
        agents.append(financial_planner)
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

    if include_research:
        agents.append(research_agent)
        tasks.append(Task(
            description=(
                f"Research any current financial information relevant to the user's question: {user_query}\n\n"
                "Look up current news, rates, or market conditions that could affect the advice. "
                "Only research what's directly relevant — don't add noise."
            ),
            expected_output="Relevant current financial information and market context.",
            agent=research_agent,
        ))

    agents.append(synthesis_agent)
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

    MEMORY_DIR.mkdir(parents=True, exist_ok=True)

    crew_kwargs: dict = {
        "agents": agents,
        "tasks": tasks,
        "process": Process.sequential,
        "verbose": False,
        "memory": True,
        "output_log_file": str(MEMORY_DIR / "crew_log.txt"),
    }

    if event_queue is not None:
        agent_names = [a.role for a in agents]
        event_queue.put({
            "event": "crew_start",
            "agents": agent_names,
            "query_type": query_type,
        })

        current_agent_idx = [0]

        def step_callback(step_output):  # type: ignore[no-untyped-def]
            try:
                agent_role = agents[current_agent_idx[0]].role if current_agent_idx[0] < len(agents) else "Unknown"
                text = ""
                if hasattr(step_output, "log") and step_output.log:
                    text = step_output.log[:200]
                elif hasattr(step_output, "text") and step_output.text:
                    text = step_output.text[:200]

                tool_name = None
                tool_input = None
                if hasattr(step_output, "tool"):
                    tool_name = step_output.tool
                    tool_input = str(getattr(step_output, "tool_input", ""))[:100]

                event: dict = {
                    "event": "step",
                    "agent": agent_role,
                    "agent_index": current_agent_idx[0],
                }
                if tool_name:
                    event["tool"] = tool_name
                    event["tool_input"] = tool_input
                elif text:
                    event["text"] = text

                event_queue.put(event)
            except Exception:
                pass

        def task_callback(task_output):  # type: ignore[no-untyped-def]
            try:
                agent_role = agents[current_agent_idx[0]].role if current_agent_idx[0] < len(agents) else "Unknown"
                summary = ""
                if hasattr(task_output, "raw") and task_output.raw:
                    summary = task_output.raw[:150]

                event_queue.put({
                    "event": "task_done",
                    "agent": agent_role,
                    "agent_index": current_agent_idx[0],
                    "summary": summary,
                })
                current_agent_idx[0] += 1

                if current_agent_idx[0] < len(agents):
                    next_role = agents[current_agent_idx[0]].role
                    event_queue.put({
                        "event": "agent_start",
                        "agent": next_role,
                        "agent_index": current_agent_idx[0],
                    })
            except Exception:
                pass

        event_queue.put({
            "event": "agent_start",
            "agent": agents[0].role,
            "agent_index": 0,
        })

        crew_kwargs["step_callback"] = step_callback
        crew_kwargs["task_callback"] = task_callback

    return Crew(**crew_kwargs)


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

    yield f"data: {json.dumps({'type': 'thinking', 'content': 'Analyzing your question...'})}\n\n"

    try:
        has_docs = len(list_documents()) > 0
        has_profile = get_profile_summary() != "No financial profile information has been collected yet."

        query_type = await asyncio.to_thread(
            _classify_query, user_message, has_docs, has_profile
        )

        yield f"data: {json.dumps({'type': 'routing', 'query_type': query_type})}\n\n"

        if query_type == "simple":
            yield f"data: {json.dumps({'type': 'thinking', 'content': 'Preparing your answer...'})}\n\n"

            response_text = await asyncio.to_thread(
                _direct_answer, user_message, conversation_context
            )
            yield f"data: {json.dumps({'type': 'text', 'content': response_text})}\n\n"
        else:
            event_q: queue.Queue = queue.Queue()

            def run_crew() -> str:
                crew = _build_advisor_crew(
                    user_message,
                    conversation_context,
                    query_type=query_type,
                    event_queue=event_q,
                )
                result = crew.kickoff()
                return str(result)

            def _run_crew_thread() -> None:
                try:
                    result_text = run_crew()
                    event_q.put(("__RESULT__", result_text))
                except Exception as exc:
                    event_q.put(("__ERROR__", str(exc)))

            thread = threading.Thread(target=_run_crew_thread, daemon=True)
            thread.start()

            while True:
                try:
                    item = await asyncio.to_thread(event_q.get, True, 1.0)
                except Exception:
                    if not thread.is_alive():
                        break
                    continue

                if isinstance(item, tuple) and len(item) == 2:
                    tag, payload = item
                    if tag == "__RESULT__":
                        yield f"data: {json.dumps({'type': 'text', 'content': payload})}\n\n"
                        break
                    elif tag == "__ERROR__":
                        yield f"data: {json.dumps({'type': 'error', 'content': f'Advisor error: {payload}'})}\n\n"
                        break

                if isinstance(item, dict):
                    event_type = item.get("event")
                    agent = item.get("agent", "")
                    desc = AGENT_DESCRIPTIONS.get(agent, "")

                    if event_type == "crew_start":
                        agents_list = item.get("agents", [])
                        yield f"data: {json.dumps({'type': 'crew_start', 'agents': agents_list, 'query_type': query_type})}\n\n"

                    elif event_type == "agent_start":
                        msg = desc or f"{agent} is working..."
                        yield f"data: {json.dumps({'type': 'thinking', 'content': msg})}\n\n"
                        yield f"data: {json.dumps({'type': 'agent_start', 'agent': agent, 'agent_index': item.get('agent_index', 0)})}\n\n"

                    elif event_type == "step":
                        tool = item.get("tool")
                        if tool:
                            tool_labels = {
                                "search_documents": "Searching your documents",
                                "get_user_profile": "Checking your profile",
                                "update_user_profile": "Updating your profile",
                                "add_profile_note": "Saving a note",
                                "get_news": "Fetching financial news",
                            }
                            label = tool_labels.get(tool, f"Using {tool}")
                            yield f"data: {json.dumps({'type': 'thinking', 'content': label})}\n\n"
                            yield f"data: {json.dumps({'type': 'tool_call', 'agent': agent, 'tool': tool})}\n\n"

                    elif event_type == "task_done":
                        yield f"data: {json.dumps({'type': 'agent_done', 'agent': agent, 'agent_index': item.get('agent_index', 0)})}\n\n"

    except Exception as e:
        logger.exception("Advisor crew execution failed")
        error_msg = f"I encountered an error processing your request: {str(e)}"
        yield f"data: {json.dumps({'type': 'error', 'content': error_msg})}\n\n"

    yield "data: [DONE]\n\n"
