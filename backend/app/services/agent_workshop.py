"""Agent Workshop — plan and execute educational CrewAI crews with live event streaming."""

import asyncio
import json
import logging
import math
import time
from collections.abc import AsyncGenerator
from typing import Any
from uuid import uuid4

from crewai import Agent, Crew, Process, Task
from crewai.tools import BaseTool
from pydantic import BaseModel, Field

from app.models.workshop import (
    AgentDefinition,
    CrewPlan,
    EventType,
    ExecutionEvent,
    TaskDefinition,
    WorkshopSession,
    SessionStatus,
    save_session,
)
from app.services.llm import get_llm

logger = logging.getLogger(__name__)


TEMPLATES: dict[str, dict[str, str]] = {
    "blog_post": {
        "title": "Blog Post Writer",
        "description": "Research a topic and write a concise blog post with key takeaways",
        "goal": (
            "Research the latest developments in renewable energy "
            "and write a concise, engaging blog post with 3 key takeaways"
        ),
    },
    "trip_planner": {
        "title": "Weekend Trip Planner",
        "description": "Plan a weekend getaway with places, food, and itinerary",
        "goal": (
            "Plan a 2-day weekend trip to Austin, Texas including "
            "top places, food recommendations, and a rough itinerary"
        ),
    },
    "decision_helper": {
        "title": "Decision Analyzer",
        "description": "Analyze pros and cons of a major life decision",
        "goal": (
            "Analyze the pros and cons of buying versus renting "
            "a home in a major US city for a young professional"
        ),
    },
    "study_plan": {
        "title": "Study Plan Creator",
        "description": "Create a structured learning plan for a new skill",
        "goal": (
            "Create a 30-day study plan for someone who wants to "
            "learn Python programming from scratch"
        ),
    },
    "product_research": {
        "title": "Product Researcher",
        "description": "Compare products and recommend the best option",
        "goal": (
            "Research and compare the top 3 noise-cancelling "
            "headphones under $400 and recommend the best one"
        ),
    },
}

AVAILABLE_TOOLS = {
    "web_search": "Search the web for current information on any topic",
    "calculator": "Perform mathematical calculations and unit conversions",
    "note_taker": "Save and retrieve intermediate findings for other agents",
    "text_analyzer": "Analyze text for sentiment, key themes, and structure",
}


_event_queue: asyncio.Queue | None = None
_notes_store: dict[str, str] = {}


def _emit_sync(event: ExecutionEvent) -> None:
    if _event_queue is not None:
        try:
            _event_queue.put_nowait(event)
        except asyncio.QueueFull:
            logger.warning("Event queue full, dropping event")


class WebSearchInput(BaseModel):
    query: str = Field(..., description="Search query to look up on the web")


class WebSearchTool(BaseTool):
    name: str = "web_search"
    description: str = "Search the web for current information on any topic."
    args_schema: type[BaseModel] = WebSearchInput

    def _run(self, query: str) -> str:
        _emit_sync(ExecutionEvent(
            type=EventType.TOOL_CALL,
            content=f"Searching: {query}",
            metadata={"tool": "web_search", "input": query},
        ))
        try:
            from ddgs import DDGS
            ddgs = DDGS()
            results = list(ddgs.text(query, max_results=5))
            if not results:
                out = f"No search results found for: {query}"
            else:
                lines = []
                for i, r in enumerate(results, 1):
                    lines.append(f"{i}. {r.get('title', '')}\n   {r.get('body', '')}\n   URL: {r.get('href', '')}")
                out = "\n\n".join(lines)
        except Exception as e:
            out = f"Search error: {e}"
        _emit_sync(ExecutionEvent(
            type=EventType.TOOL_RESULT,
            content=out[:500],
            metadata={"tool": "web_search"},
        ))
        return out


class CalculatorInput(BaseModel):
    expression: str = Field(..., description="Math expression to evaluate, e.g. '(45 * 12) + 100'")


class CalculatorTool(BaseTool):
    name: str = "calculator"
    description: str = "Perform mathematical calculations safely."
    args_schema: type[BaseModel] = CalculatorInput

    def _run(self, expression: str) -> str:
        _emit_sync(ExecutionEvent(
            type=EventType.TOOL_CALL,
            content=f"Calculating: {expression}",
            metadata={"tool": "calculator", "input": expression},
        ))
        try:
            allowed = {
                "abs": abs, "round": round, "min": min, "max": max,
                "sum": sum, "pow": pow, "int": int, "float": float,
                "sqrt": math.sqrt, "pi": math.pi, "e": math.e,
                "log": math.log, "log10": math.log10, "ceil": math.ceil,
                "floor": math.floor,
            }
            result = str(eval(expression, {"__builtins__": {}}, allowed))
        except Exception as e:
            result = f"Calculation error: {e}"
        _emit_sync(ExecutionEvent(
            type=EventType.TOOL_RESULT,
            content=result,
            metadata={"tool": "calculator"},
        ))
        return result


class NoteTakerInput(BaseModel):
    action: str = Field(..., description="'save' or 'retrieve'")
    key: str = Field(..., description="Note key/name")
    content: str = Field("", description="Note content (for save)")


class NoteTakerTool(BaseTool):
    name: str = "note_taker"
    description: str = (
        "Save intermediate findings with a key, or retrieve saved notes. "
        "Use action='save' with key and content, or action='retrieve' with key."
    )
    args_schema: type[BaseModel] = NoteTakerInput

    def _run(self, action: str = "save", key: str = "", content: str = "") -> str:
        _emit_sync(ExecutionEvent(
            type=EventType.TOOL_CALL,
            content=f"Note: {action} '{key}'",
            metadata={"tool": "note_taker", "action": action, "key": key},
        ))
        if action == "save":
            _notes_store[key] = content
            result = f"Saved note '{key}'"
        else:
            result = _notes_store.get(key, f"No note found for '{key}'")
        _emit_sync(ExecutionEvent(
            type=EventType.TOOL_RESULT,
            content=result[:300],
            metadata={"tool": "note_taker"},
        ))
        return result


class TextAnalyzerInput(BaseModel):
    text: str = Field(..., description="Text to analyze")
    analysis_type: str = Field(
        "general",
        description="Type of analysis: 'sentiment', 'themes', 'structure', or 'general'",
    )


class TextAnalyzerTool(BaseTool):
    name: str = "text_analyzer"
    description: str = "Analyze text for sentiment, key themes, structure, or general insights."
    args_schema: type[BaseModel] = TextAnalyzerInput

    def _run(self, text: str, analysis_type: str = "general") -> str:
        _emit_sync(ExecutionEvent(
            type=EventType.TOOL_CALL,
            content=f"Analyzing text ({analysis_type}): {text[:100]}...",
            metadata={"tool": "text_analyzer", "type": analysis_type},
        ))
        try:
            llm = get_llm()
            prompt = (
                f"Analyze the following text. Focus on {analysis_type} analysis.\n\n"
                f"Text: {text[:2000]}\n\n"
                f"Provide a concise analysis in 2-3 sentences."
            )
            result = llm.call([{"role": "user", "content": prompt}])
            if not isinstance(result, str):
                result = str(result)
        except Exception as e:
            result = f"Analysis error: {e}"
        _emit_sync(ExecutionEvent(
            type=EventType.TOOL_RESULT,
            content=result[:500],
            metadata={"tool": "text_analyzer"},
        ))
        return result


TOOL_MAP: dict[str, type[BaseTool]] = {
    "web_search": WebSearchTool,
    "calculator": CalculatorTool,
    "note_taker": NoteTakerTool,
    "text_analyzer": TextAnalyzerTool,
}


async def plan_crew(goal: str) -> CrewPlan:
    """Use LLM to decompose a goal into an agent crew plan."""
    llm = get_llm()

    available_tools_desc = "\n".join(
        f"  - \"{name}\": {desc}" for name, desc in AVAILABLE_TOOLS.items()
    )

    prompt = (
        "You are an AI architect designing a multi-agent system. "
        "Given the user's goal, design an efficient crew of 2-4 AI agents.\n\n"
        f"USER GOAL: {goal}\n\n"
        f"AVAILABLE TOOLS (assign relevant ones to each agent):\n{available_tools_desc}\n\n"
        "Design the crew and output ONLY a JSON object with this structure:\n"
        '{\n'
        '  "summary": "Brief 1-2 sentence description of the crew plan",\n'
        '  "agents": [\n'
        '    {\n'
        '      "name": "Agent Name",\n'
        '      "role": "Specific Role Title",\n'
        '      "goal": "What this agent aims to accomplish",\n'
        '      "backstory": "Brief background establishing expertise (2-3 sentences)",\n'
        '      "tools": ["tool_name_1", "tool_name_2"],\n'
        '      "order": 0\n'
        '    }\n'
        '  ],\n'
        '  "tasks": [\n'
        '    {\n'
        '      "description": "Detailed task description",\n'
        '      "agent_index": 0,\n'
        '      "expected_output": "What this task should produce",\n'
        '      "order": 0\n'
        '    }\n'
        '  ]\n'
        '}\n\n'
        "RULES:\n"
        "- 2-4 agents maximum, each with a distinct role\n"
        "- Each agent should have 1-2 tools most relevant to their role\n"
        "- Tasks execute sequentially; later agents build on earlier outputs\n"
        "- agent_index refers to the agent's position in the agents array (0-based)\n"
        "- Keep backstories concise but give each agent personality\n"
        "- Output ONLY the JSON, no other text"
    )

    raw = await asyncio.to_thread(
        llm.call, [{"role": "user", "content": prompt}]
    )
    raw_str = str(raw)

    try:
        start = raw_str.find("{")
        end = raw_str.rfind("}") + 1
        if start >= 0 and end > start:
            parsed = json.loads(raw_str[start:end])
        else:
            raise ValueError("No JSON found in LLM response")
    except (json.JSONDecodeError, ValueError) as e:
        logger.warning("Failed to parse crew plan: %s", e)
        return _fallback_plan(goal)

    agents: list[AgentDefinition] = []
    for i, a in enumerate(parsed.get("agents", [])):
        tools = [t for t in a.get("tools", []) if t in AVAILABLE_TOOLS]
        agents.append(AgentDefinition(
            name=a.get("name", f"Agent {i+1}"),
            role=a.get("role", "General Assistant"),
            goal=a.get("goal", "Help accomplish the user's objective"),
            backstory=a.get("backstory", "An experienced professional."),
            tools=tools,
            order=i,
        ))

    tasks: list[TaskDefinition] = []
    for i, t in enumerate(parsed.get("tasks", [])):
        agent_idx = t.get("agent_index", min(i, len(agents) - 1))
        if agent_idx >= len(agents):
            agent_idx = len(agents) - 1
        tasks.append(TaskDefinition(
            description=t.get("description", ""),
            agent_id=agents[agent_idx].id if agents else "",
            expected_output=t.get("expected_output", ""),
            order=i,
        ))

    return CrewPlan(
        agents=agents,
        tasks=tasks,
        execution_order="sequential",
        summary=parsed.get("summary", f"A crew of {len(agents)} agents to: {goal[:100]}"),
    )


def _fallback_plan(goal: str) -> CrewPlan:
    researcher = AgentDefinition(
        name="Researcher",
        role="Research Specialist",
        goal=f"Research information relevant to: {goal}",
        backstory="An experienced researcher skilled at finding and synthesizing information.",
        tools=["web_search", "note_taker"],
        order=0,
    )
    writer = AgentDefinition(
        name="Writer",
        role="Content Synthesizer",
        goal=f"Synthesize research into a clear, actionable response for: {goal}",
        backstory="A skilled writer who distills complex research into clear, engaging content.",
        tools=["text_analyzer", "note_taker"],
        order=1,
    )
    return CrewPlan(
        agents=[researcher, writer],
        tasks=[
            TaskDefinition(
                description=f"Research the following topic thoroughly: {goal}",
                agent_id=researcher.id,
                expected_output="Comprehensive research findings with key data points.",
                order=0,
            ),
            TaskDefinition(
                description=(
                    f"Using the research findings, create a well-structured response "
                    f"that addresses the goal: {goal}"
                ),
                agent_id=writer.id,
                expected_output="A clear, actionable response addressing the user's goal.",
                order=1,
            ),
        ],
        execution_order="sequential",
        summary=f"A 2-agent crew (Researcher + Writer) to: {goal[:100]}",
    )


_current_agent_name: str | None = None
_agent_start_times: dict[str, float] = {}


def _task_callback(task_output: Any) -> None:
    """Called by CrewAI when a task completes — used to track agent transitions."""
    agent_name = _current_agent_name
    if agent_name and agent_name in _agent_start_times:
        elapsed = time.time() - _agent_start_times[agent_name]
        _emit_sync(ExecutionEvent(
            type=EventType.AGENT_COMPLETE,
            agent_name=agent_name,
            content=f"{agent_name} completed their work.",
            metadata={"duration_seconds": round(elapsed, 1)},
        ))


async def execute_crew(plan: CrewPlan) -> AsyncGenerator[ExecutionEvent, None]:
    """Execute a crew plan and yield execution events as they happen."""
    global _event_queue, _notes_store, _current_agent_name, _agent_start_times
    _event_queue = asyncio.Queue(maxsize=500)
    _notes_store = {}
    _current_agent_name = None
    _agent_start_times = {}

    start_time = time.time()
    agent_map: dict[str, AgentDefinition] = {a.id: a for a in plan.agents}
    total_tool_calls = 0

    crewai_role_to_name: dict[str, str] = {}

    try:
        llm = get_llm()
        crewai_agents: dict[str, Agent] = {}
        for agent_def in sorted(plan.agents, key=lambda a: a.order):
            tools = [TOOL_MAP[t]() for t in agent_def.tools if t in TOOL_MAP]
            crewai_agents[agent_def.id] = Agent(
                role=agent_def.role,
                goal=agent_def.goal,
                backstory=agent_def.backstory,
                tools=tools,
                llm=llm,
                verbose=False,
            )
            crewai_role_to_name[agent_def.role] = agent_def.name

        sorted_tasks = sorted(plan.tasks, key=lambda t: t.order)
        crewai_tasks: list[Task] = []
        task_agent_names: list[str] = []
        for task_def in sorted_tasks:
            agent_id = task_def.agent_id
            if agent_id not in crewai_agents:
                agent_id = plan.agents[0].id if plan.agents else ""
            agent_def_for_task = agent_map.get(agent_id)
            agent_name = agent_def_for_task.name if agent_def_for_task else "Unknown"
            task_agent_names.append(agent_name)
            crewai_tasks.append(Task(
                description=task_def.description,
                expected_output=task_def.expected_output,
                agent=crewai_agents[agent_id],
            ))

        agents_list = [
            crewai_agents[a.id]
            for a in sorted(plan.agents, key=lambda a: a.order)
            if a.id in crewai_agents
        ]

        def step_callback(step_output: Any) -> None:
            """Track which agent is currently active from step events."""
            global _current_agent_name
            try:
                agent_role = None
                if hasattr(step_output, 'agent') and step_output.agent:
                    agent_role = getattr(step_output.agent, 'role', None)
                if not agent_role and hasattr(step_output, 'role'):
                    agent_role = step_output.role

                if agent_role and agent_role in crewai_role_to_name:
                    new_name = crewai_role_to_name[agent_role]
                    if new_name != _current_agent_name:
                        if _current_agent_name and _current_agent_name in _agent_start_times:
                            elapsed = time.time() - _agent_start_times[_current_agent_name]
                            _emit_sync(ExecutionEvent(
                                type=EventType.AGENT_COMPLETE,
                                agent_name=_current_agent_name,
                                content=f"{_current_agent_name} completed their work.",
                                metadata={"duration_seconds": round(elapsed, 1)},
                            ))
                            prev_name = _current_agent_name
                            _emit_sync(ExecutionEvent(
                                type=EventType.HANDOFF,
                                agent_name=prev_name,
                                content=f"Passing findings to {new_name}...",
                                metadata={"from": prev_name, "to": new_name},
                            ))
                        _current_agent_name = new_name
                        _agent_start_times[new_name] = time.time()
                        _emit_sync(ExecutionEvent(
                            type=EventType.AGENT_START,
                            agent_name=new_name,
                            content=f"{new_name} is starting work...",
                        ))
            except Exception:
                pass

        crew = Crew(
            agents=agents_list,
            tasks=crewai_tasks,
            process=Process.sequential,
            verbose=False,
            step_callback=step_callback,
            task_callback=_task_callback,
        )

        first_agent = sorted(plan.agents, key=lambda a: a.order)[0] if plan.agents else None
        if first_agent:
            _current_agent_name = first_agent.name
            _agent_start_times[first_agent.name] = time.time()
            yield ExecutionEvent(
                type=EventType.AGENT_START,
                agent_name=first_agent.name,
                content=f"{first_agent.name} is starting work...",
            )

        result_task = asyncio.ensure_future(asyncio.to_thread(crew.kickoff))

        done = False
        while not done:
            try:
                event = await asyncio.wait_for(_event_queue.get(), timeout=0.5)
                if event.type == EventType.TOOL_CALL:
                    total_tool_calls += 1
                yield event
            except (asyncio.TimeoutError, TimeoutError):
                if result_task.done():
                    while not _event_queue.empty():
                        event = _event_queue.get_nowait()
                        if event.type == EventType.TOOL_CALL:
                            total_tool_calls += 1
                        yield event
                    done = True

        result = await result_task
        result_str = str(result)
        elapsed = time.time() - start_time

        if _current_agent_name and _current_agent_name in _agent_start_times:
            agent_elapsed = time.time() - _agent_start_times[_current_agent_name]
            yield ExecutionEvent(
                type=EventType.AGENT_COMPLETE,
                agent_name=_current_agent_name,
                content=f"{_current_agent_name} completed their work.",
                metadata={"duration_seconds": round(agent_elapsed, 1)},
            )

        yield ExecutionEvent(
            type=EventType.CREW_COMPLETE,
            content=result_str,
            metadata={
                "execution_time_seconds": round(elapsed, 1),
                "total_tool_calls": total_tool_calls,
                "agents_used": len(plan.agents),
            },
        )

    except Exception as e:
        logger.exception("Crew execution failed")
        yield ExecutionEvent(
            type=EventType.ERROR,
            content=f"Execution error: {str(e)}",
        )
    finally:
        _event_queue = None
        _notes_store = {}
        _current_agent_name = None
        _agent_start_times = {}


async def stream_workshop_events(plan: CrewPlan, goal: str) -> AsyncGenerator[str, None]:
    """Wrap execute_crew as SSE text stream and persist the session."""
    session = WorkshopSession(
        goal=goal,
        crew_plan=plan,
        status=SessionStatus.RUNNING,
    )
    save_session(session)
    events_collected: list[ExecutionEvent] = []
    result_text = ""
    exec_time = 0.0
    total_tools = 0

    try:
        async for event in execute_crew(plan):
            events_collected.append(event)
            yield f"data: {json.dumps(event.model_dump())}\n\n"

            if event.type == EventType.CREW_COMPLETE:
                result_text = event.content
                exec_time = event.metadata.get("execution_time_seconds", 0)
                total_tools = event.metadata.get("total_tool_calls", 0)

        session.events = events_collected
        session.result = result_text
        session.execution_time_seconds = exec_time
        session.total_tokens = total_tools
        session.status = SessionStatus.COMPLETE
    except Exception as e:
        session.status = SessionStatus.ERROR
        session.result = str(e)
        yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
    finally:
        save_session(session)

    yield "data: [DONE]\n\n"
