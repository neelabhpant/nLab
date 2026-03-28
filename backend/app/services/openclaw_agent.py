"""OpenClaw Lite — single-agent gateway with configurable skills and streaming execution."""

import asyncio
import csv
import io
import json
import logging
import math
import os
import platform
import re
import shutil
import smtplib
import subprocess
import threading
import time
import uuid
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from enum import Enum
from pathlib import Path
from typing import Any

from crewai import Agent, Crew, Process, Task
from crewai.tools import BaseTool
from pydantic import BaseModel, Field

from app.config import get_settings
from app.services.llm import get_llm

logger = logging.getLogger(__name__)


class OCEventType(str, Enum):
    GATEWAY_STATUS = "gateway_status"
    THINKING = "thinking"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    MEMORY_UPDATE = "memory_update"
    RESPONSE = "response"
    ERROR = "error"
    FILE_GENERATED = "file_generated"
    CONFIRMATION_REQUIRED = "confirmation_required"
    CONFIRMATION_RESULT = "confirmation_result"
    DONE = "done"


class OCEvent(BaseModel):
    type: OCEventType
    content: str = ""
    timestamp: float = Field(default_factory=lambda: datetime.now(timezone.utc).timestamp())
    metadata: dict[str, Any] = Field(default_factory=dict)


class SkillDefinition(BaseModel):
    id: str
    name: str
    description: str
    enabled: bool = True
    builtin: bool = True
    instruction: str = ""


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    skills: list[SkillDefinition] = Field(default_factory=list)
    soul: str = ""
    memory: dict[str, str] = Field(default_factory=dict)


DEFAULT_SKILLS: list[SkillDefinition] = [
    SkillDefinition(
        id="web_search",
        name="Web Search",
        description="Search the web for current information on any topic",
        enabled=True,
        builtin=True,
    ),
    SkillDefinition(
        id="calculator",
        name="Calculator",
        description="Perform mathematical calculations and unit conversions",
        enabled=True,
        builtin=True,
    ),
    SkillDefinition(
        id="memory",
        name="Memory",
        description="Save and retrieve persistent memories across conversations",
        enabled=True,
        builtin=True,
    ),
    SkillDefinition(
        id="url_fetcher",
        name="URL Fetcher",
        description="Fetch and summarize content from a given URL",
        enabled=False,
        builtin=True,
    ),
    SkillDefinition(
        id="text_analyzer",
        name="Text Analyzer",
        description="Analyze text for sentiment, key themes, and structure",
        enabled=False,
        builtin=True,
    ),
    SkillDefinition(
        id="note_taker",
        name="Note Taker",
        description="Save and retrieve intermediate notes during a task",
        enabled=False,
        builtin=True,
    ),
    SkillDefinition(
        id="send_email",
        name="Send Email",
        description="Send an email with a subject and body to a recipient",
        enabled=False,
        builtin=True,
    ),
    SkillDefinition(
        id="file_generator",
        name="File Generator",
        description="Generate downloadable PDF or CSV reports from content",
        enabled=False,
        builtin=True,
    ),
    SkillDefinition(
        id="file_explorer",
        name="File Explorer",
        description="Browse directories and read local files (sandboxed)",
        enabled=False,
        builtin=True,
    ),
    SkillDefinition(
        id="system_monitor",
        name="System Monitor",
        description="Check CPU, memory, disk usage, and running processes",
        enabled=False,
        builtin=True,
    ),
    SkillDefinition(
        id="local_search",
        name="Local Search",
        description="Search for files by name or content within allowed directories",
        enabled=False,
        builtin=True,
    ),
    SkillDefinition(
        id="git_status",
        name="Git Status",
        description="Check git status, log, and diff for local repositories",
        enabled=False,
        builtin=True,
    ),
    SkillDefinition(
        id="clipboard_read",
        name="Clipboard Read",
        description="Read current clipboard contents",
        enabled=False,
        builtin=True,
    ),
    SkillDefinition(
        id="file_writer",
        name="File Writer",
        description="Create or edit local files (requires confirmation)",
        enabled=False,
        builtin=True,
    ),
    SkillDefinition(
        id="shell_runner",
        name="Shell Runner",
        description="Execute allowed shell commands (requires confirmation)",
        enabled=False,
        builtin=True,
    ),
    SkillDefinition(
        id="app_launcher",
        name="App Launcher",
        description="Open applications or URLs on the local system (requires confirmation)",
        enabled=False,
        builtin=True,
    ),
    SkillDefinition(
        id="browser_agent",
        name="Browser Agent",
        description="Autonomously browse any website - read messages, fill forms, extract data. Uses your saved login sessions.",
        enabled=False,
        builtin=True,
    ),
    SkillDefinition(
        id="browser_login",
        name="Browser Login",
        description="Open a visible browser to log into a website. Sessions are saved for future browser_agent use.",
        enabled=False,
        builtin=True,
    ),
]


GENERATED_FILES_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "openclaw_files"
GENERATED_FILES_DIR.mkdir(parents=True, exist_ok=True)

_event_queue: asyncio.Queue | None = None
_main_loop: asyncio.AbstractEventLoop | None = None
_memory_store: dict[str, str] = {}
_notes_store: dict[str, str] = {}
_search_cache: dict[str, str] = {}
_last_generated_file: Path | None = None
_confirmation_events: dict[str, asyncio.Event] = {}
_confirmation_results: dict[str, bool] = {}
_abort_event: threading.Event | None = None
_session_id: str | None = None
_active_browser_agent = None
_active_browser_session = None

BLOCKED_PATTERNS = [
    ".env", ".ssh", ".gnupg", ".aws", ".config/gcloud",
    "id_rsa", "id_ed25519", ".pem", ".key", "credentials",
    "secrets", "tokens", ".keychain",
]


def _get_allowed_paths() -> list[Path]:
    settings = get_settings()
    if not settings.local_allowed_paths:
        return [Path.home() / "Documents", Path.home() / "Desktop", Path.home() / "Downloads"]
    return [Path(p.strip()) for p in settings.local_allowed_paths.split(",") if p.strip()]


def _get_shell_allowlist() -> list[str]:
    settings = get_settings()
    return [c.strip() for c in settings.local_shell_allowlist.split(",") if c.strip()]


def _is_path_allowed(path: Path) -> bool:
    resolved = path.resolve()
    path_str = str(resolved).lower()
    for pattern in BLOCKED_PATTERNS:
        if pattern in path_str:
            return False
    allowed = _get_allowed_paths()
    return any(str(resolved).startswith(str(a.resolve())) for a in allowed)


async def _request_confirmation(action: str, details: str) -> bool:
    confirmation_id = str(uuid.uuid4())[:8]
    event = asyncio.Event()
    _confirmation_events[confirmation_id] = event
    _emit(OCEvent(
        type=OCEventType.CONFIRMATION_REQUIRED,
        content=action,
        metadata={"confirmation_id": confirmation_id, "details": details},
    ))
    try:
        await asyncio.wait_for(event.wait(), timeout=120)
    except (asyncio.TimeoutError, TimeoutError):
        _confirmation_results[confirmation_id] = False
    approved = _confirmation_results.pop(confirmation_id, False)
    _confirmation_events.pop(confirmation_id, None)
    _emit(OCEvent(
        type=OCEventType.CONFIRMATION_RESULT,
        content="approved" if approved else "denied",
        metadata={"confirmation_id": confirmation_id, "action": action},
    ))
    return approved


def resolve_confirmation(confirmation_id: str, approved: bool) -> bool:
    """Called by the router when user approves/denies an action."""
    if confirmation_id not in _confirmation_events:
        return False
    _confirmation_results[confirmation_id] = approved
    _confirmation_events[confirmation_id].set()
    return True


def abort_session(session_id: str) -> bool:
    """Signal the running session to abort."""
    if _session_id == session_id and _abort_event is not None:
        _abort_event.set()
        if _active_browser_agent is not None:
            try:
                _active_browser_agent.stop()
            except Exception:
                pass
        if _active_browser_session is not None:
            try:
                import asyncio as _aio
                loop = _aio.new_event_loop()
                loop.run_until_complete(_active_browser_session.close())
                loop.close()
            except Exception:
                pass
        return True
    return False


def get_current_session_id() -> str | None:
    return _session_id


def _is_aborted() -> bool:
    return _abort_event is not None and _abort_event.is_set()


def _emit(event: OCEvent) -> None:
    if _event_queue is not None:
        try:
            _event_queue.put_nowait(event)
        except asyncio.QueueFull:
            logger.warning("OpenClaw event queue full")


def _normalize_query(query: str) -> str:
    current_year = datetime.now().year
    query = re.sub(
        r'\b(20[0-9]{2})\b',
        lambda m: str(current_year) if int(m.group(1)) < current_year else m.group(0),
        query,
    )
    return query.strip()


def _query_cache_key(query: str) -> str:
    words = sorted(set(query.lower().split()))
    return " ".join(words)


class OCWebSearchInput(BaseModel):
    query: str = Field(..., description="Search query")


class OCWebSearchTool(BaseTool):
    name: str = "web_search"
    description: str = "Search the web for current information on any topic."
    args_schema: type[BaseModel] = OCWebSearchInput

    def _run(self, query: str) -> str:
        if _is_aborted():
            return "Aborted by user."
        query = _normalize_query(query)
        cache_key = _query_cache_key(query)
        if cache_key in _search_cache:
            _emit(OCEvent(
                type=OCEventType.TOOL_CALL,
                content=f"Searching: {query} (cached)",
                metadata={"skill": "web_search", "input": query, "cached": True},
            ))
            out = _search_cache[cache_key]
            _emit(OCEvent(type=OCEventType.TOOL_RESULT, content=out[:500], metadata={"skill": "web_search"}))
            return out

        _emit(OCEvent(
            type=OCEventType.TOOL_CALL,
            content=f"Searching: {query}",
            metadata={"skill": "web_search", "input": query},
        ))
        try:
            from ddgs import DDGS
            ddgs = DDGS()
            results = list(ddgs.text(query, max_results=5))
            if not results:
                out = f"No results found for: {query}"
            else:
                lines = []
                for i, r in enumerate(results, 1):
                    lines.append(f"{i}. {r.get('title', '')}\n   {r.get('body', '')}\n   URL: {r.get('href', '')}")
                out = "\n\n".join(lines)
        except Exception as e:
            out = f"Search error: {e}"
        _search_cache[cache_key] = out
        _emit(OCEvent(type=OCEventType.TOOL_RESULT, content=out[:500], metadata={"skill": "web_search"}))
        return out


class OCCalculatorInput(BaseModel):
    expression: str = Field(..., description="Math expression to evaluate")


class OCCalculatorTool(BaseTool):
    name: str = "calculator"
    description: str = "Perform mathematical calculations safely."
    args_schema: type[BaseModel] = OCCalculatorInput

    def _run(self, expression: str) -> str:
        _emit(OCEvent(
            type=OCEventType.TOOL_CALL,
            content=f"Calculating: {expression}",
            metadata={"skill": "calculator", "input": expression},
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
        _emit(OCEvent(type=OCEventType.TOOL_RESULT, content=result, metadata={"skill": "calculator"}))
        return result


class OCMemoryInput(BaseModel):
    action: str = Field(..., description="'save' or 'recall'")
    key: str = Field(..., description="Memory key")
    value: str = Field("", description="Value to save (for save action)")


class OCMemoryTool(BaseTool):
    name: str = "memory"
    description: str = (
        "Save or recall persistent memories. "
        "Use action='save' with key and value to store, action='recall' with key to retrieve."
    )
    args_schema: type[BaseModel] = OCMemoryInput

    def _run(self, action: str = "save", key: str = "", value: str = "") -> str:
        _emit(OCEvent(
            type=OCEventType.TOOL_CALL,
            content=f"Memory: {action} '{key}'",
            metadata={"skill": "memory", "action": action, "key": key},
        ))
        if action == "save":
            _memory_store[key] = value
            result = f"Saved memory '{key}'"
            _emit(OCEvent(
                type=OCEventType.MEMORY_UPDATE,
                content=f"Stored: {key}",
                metadata={"key": key, "value": value},
            ))
        else:
            result = _memory_store.get(key, f"No memory found for '{key}'")
        _emit(OCEvent(type=OCEventType.TOOL_RESULT, content=result[:300], metadata={"skill": "memory"}))
        return result


class OCUrlFetcherInput(BaseModel):
    url: str = Field(..., description="URL to fetch content from")


class OCUrlFetcherTool(BaseTool):
    name: str = "url_fetcher"
    description: str = "Fetch and summarize the content of a web page."
    args_schema: type[BaseModel] = OCUrlFetcherInput

    def _run(self, url: str) -> str:
        if _is_aborted():
            return "Aborted by user."
        _emit(OCEvent(
            type=OCEventType.TOOL_CALL,
            content=f"Fetching: {url}",
            metadata={"skill": "url_fetcher", "input": url},
        ))
        try:
            import httpx
            resp = httpx.get(url, timeout=15, follow_redirects=True)
            resp.raise_for_status()
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(resp.text, "html.parser")
            for tag in soup(["script", "style", "nav", "footer", "header"]):
                tag.decompose()
            text = soup.get_text(separator="\n", strip=True)
            result = text[:3000]
        except Exception as e:
            result = f"Fetch error: {e}"
        _emit(OCEvent(type=OCEventType.TOOL_RESULT, content=result[:500], metadata={"skill": "url_fetcher"}))
        return result


class OCTextAnalyzerInput(BaseModel):
    text: str = Field(..., description="Text to analyze")
    analysis_type: str = Field("general", description="'sentiment', 'themes', 'structure', or 'general'")


class OCTextAnalyzerTool(BaseTool):
    name: str = "text_analyzer"
    description: str = "Analyze text for sentiment, key themes, structure, or general insights."
    args_schema: type[BaseModel] = OCTextAnalyzerInput

    def _run(self, text: str, analysis_type: str = "general") -> str:
        _emit(OCEvent(
            type=OCEventType.TOOL_CALL,
            content=f"Analyzing text ({analysis_type}): {text[:80]}...",
            metadata={"skill": "text_analyzer", "type": analysis_type},
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
        _emit(OCEvent(type=OCEventType.TOOL_RESULT, content=result[:500], metadata={"skill": "text_analyzer"}))
        return result


class OCNoteTakerInput(BaseModel):
    action: str = Field(..., description="'save' or 'retrieve'")
    key: str = Field(..., description="Note key")
    content: str = Field("", description="Note content (for save)")


class OCNoteTakerTool(BaseTool):
    name: str = "note_taker"
    description: str = (
        "Save or retrieve notes during a task. "
        "Use action='save' with key and content, or action='retrieve' with key."
    )
    args_schema: type[BaseModel] = OCNoteTakerInput

    def _run(self, action: str = "save", key: str = "", content: str = "") -> str:
        _emit(OCEvent(
            type=OCEventType.TOOL_CALL,
            content=f"Note: {action} '{key}'",
            metadata={"skill": "note_taker", "action": action, "key": key},
        ))
        if action == "save":
            _notes_store[key] = content
            result = f"Saved note '{key}'"
        else:
            result = _notes_store.get(key, f"No note found for '{key}'")
        _emit(OCEvent(type=OCEventType.TOOL_RESULT, content=result[:300], metadata={"skill": "note_taker"}))
        return result


class OCSendEmailInput(BaseModel):
    to: str = Field(..., description="Recipient email address")
    subject: str = Field(..., description="Email subject line")
    body: str = Field(..., description="Email body text (plain text or simple HTML)")
    attach_last_file: bool = Field(False, description="If true, attach the most recently generated file (PDF/CSV) to the email")


class OCSendEmailTool(BaseTool):
    name: str = "send_email"
    description: str = (
        "Send an email to a recipient with a subject and body. "
        "The body can contain plain text or simple HTML formatting. "
        "Set attach_last_file=true to attach the most recently generated file (from file_generator)."
    )
    args_schema: type[BaseModel] = OCSendEmailInput

    def _run(self, to: str = "", subject: str = "", body: str = "", attach_last_file: bool = False) -> str:
        _emit(OCEvent(
            type=OCEventType.TOOL_CALL,
            content=f"Sending email to {to}: {subject}",
            metadata={"skill": "send_email", "to": to, "subject": subject},
        ))
        settings = get_settings()
        if not settings.smtp_host or not settings.smtp_user:
            result = (
                "Email not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD, "
                "and SMTP_FROM_EMAIL in your .env file to enable email sending."
            )
            _emit(OCEvent(type=OCEventType.TOOL_RESULT, content=result, metadata={"skill": "send_email"}))
            return result
        try:
            msg = MIMEMultipart("mixed")
            msg["From"] = settings.smtp_from_email or settings.smtp_user
            msg["To"] = to
            msg["Subject"] = subject
            msg.attach(MIMEText(body, "plain"))
            if "<" in body and ">" in body:
                msg.attach(MIMEText(body, "html"))
            global _last_generated_file
            if attach_last_file and _last_generated_file and _last_generated_file.exists():
                from email.mime.application import MIMEApplication
                file_bytes = _last_generated_file.read_bytes()
                attachment = MIMEApplication(file_bytes, _subtype=_last_generated_file.suffix.lstrip("."))
                attachment.add_header(
                    "Content-Disposition",
                    "attachment",
                    filename=_last_generated_file.name,
                )
                msg.attach(attachment)
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
                server.starttls()
                server.login(settings.smtp_user, settings.smtp_password.replace(" ", ""))
                server.send_message(msg)
            result = f"Email sent successfully to {to}"
        except Exception as e:
            result = f"Email error: {e}"
        _emit(OCEvent(type=OCEventType.TOOL_RESULT, content=result, metadata={"skill": "send_email"}))
        return result


class OCFileGeneratorInput(BaseModel):
    filename: str = Field(..., description="Output filename without extension (e.g. 'market_report')")
    format: str = Field("pdf", description="'pdf' or 'csv'")
    title: str = Field("", description="Title for the document (PDF only)")
    content: str = Field(..., description="The text content for PDF, or CSV rows as 'col1,col2\nval1,val2'")


class OCFileGeneratorTool(BaseTool):
    name: str = "file_generator"
    description: str = (
        "Generate a downloadable PDF or CSV file. "
        "For PDF: provide title and content text. "
        "For CSV: provide content as comma-separated rows with a header row."
    )
    args_schema: type[BaseModel] = OCFileGeneratorInput

    def _run(
        self,
        filename: str = "report",
        format: str = "pdf",
        title: str = "",
        content: str = "",
    ) -> str:
        _emit(OCEvent(
            type=OCEventType.TOOL_CALL,
            content=f"Generating {format.upper()}: {filename}",
            metadata={"skill": "file_generator", "format": format, "filename": filename},
        ))
        try:
            file_id = str(uuid.uuid4())[:8]
            safe_name = re.sub(r'[^a-zA-Z0-9_\-]', '_', filename)

            if format.lower() == "csv":
                ext = "csv"
                out_path = GENERATED_FILES_DIR / f"{safe_name}_{file_id}.csv"
                out_path.write_text(content, encoding="utf-8")
            else:
                ext = "pdf"
                out_path = GENERATED_FILES_DIR / f"{safe_name}_{file_id}.pdf"
                _generate_pdf(out_path, title or filename, content)

            download_name = f"{safe_name}.{ext}"
            global _last_generated_file
            _last_generated_file = out_path
            result = f"File generated: {download_name}"
            _emit(OCEvent(
                type=OCEventType.FILE_GENERATED,
                content=download_name,
                metadata={
                    "skill": "file_generator",
                    "file_id": f"{safe_name}_{file_id}.{ext}",
                    "download_name": download_name,
                    "format": ext,
                },
            ))
        except Exception as e:
            result = f"File generation error: {e}"
        _emit(OCEvent(type=OCEventType.TOOL_RESULT, content=result, metadata={"skill": "file_generator"}))
        return result


def _generate_pdf(path: Path, title: str, content: str) -> None:
    """Create a simple PDF using PyMuPDF (fitz)."""
    import fitz

    doc = fitz.open()
    margin = 50
    page_width = 595
    page_height = 842
    usable_width = page_width - 2 * margin

    page = doc.new_page(width=page_width, height=page_height)
    y = margin

    title_font_size = 18
    body_font_size = 11
    line_height = body_font_size * 1.5

    page.insert_text(
        fitz.Point(margin, y + title_font_size),
        title,
        fontsize=title_font_size,
        fontname="helv",
        color=(0.2, 0.2, 0.2),
    )
    y += title_font_size + 20

    page.draw_line(
        fitz.Point(margin, y),
        fitz.Point(page_width - margin, y),
        color=(0.85, 0.85, 0.85),
        width=0.5,
    )
    y += 15

    date_str = datetime.now().strftime("%B %d, %Y")
    page.insert_text(
        fitz.Point(margin, y + 9),
        f"Generated by OpenClaw Lite — {date_str}",
        fontsize=9,
        fontname="helv",
        color=(0.5, 0.5, 0.5),
    )
    y += 25

    for line in content.split("\n"):
        if y + line_height > page_height - margin:
            page = doc.new_page(width=page_width, height=page_height)
            y = margin

        while line:
            chars_per_line = int(usable_width / (body_font_size * 0.5))
            chunk = line[:chars_per_line]
            line = line[chars_per_line:]
            page.insert_text(
                fitz.Point(margin, y + body_font_size),
                chunk,
                fontsize=body_font_size,
                fontname="helv",
                color=(0.15, 0.15, 0.15),
            )
            y += line_height
            if y + line_height > page_height - margin:
                page = doc.new_page(width=page_width, height=page_height)
                y = margin

    doc.save(str(path))
    doc.close()


class OCFileExplorerInput(BaseModel):
    action: str = Field("list", description="'list' to browse directory, 'read' to read file contents")
    path: str = Field(..., description="Absolute path to a file or directory")


class OCFileExplorerTool(BaseTool):
    name: str = "file_explorer"
    description: str = (
        "Browse local directories and read file contents. "
        "Use action='list' with a directory path, or action='read' with a file path. "
        "Only works within allowed directories."
    )
    args_schema: type[BaseModel] = OCFileExplorerInput

    def _run(self, action: str = "list", path: str = "") -> str:
        _emit(OCEvent(
            type=OCEventType.TOOL_CALL,
            content=f"File Explorer: {action} {path}",
            metadata={"skill": "file_explorer", "action": action, "path": path},
        ))
        try:
            p = Path(path).expanduser().resolve()
            if not _is_path_allowed(p):
                result = f"Access denied: {path} is outside allowed directories"
            elif action == "list":
                if not p.is_dir():
                    result = f"Not a directory: {path}"
                else:
                    entries = []
                    for item in sorted(p.iterdir()):
                        if item.name.startswith("."):
                            continue
                        kind = "DIR" if item.is_dir() else "FILE"
                        size = item.stat().st_size if item.is_file() else 0
                        entries.append(f"  [{kind}] {item.name}" + (f"  ({_human_size(size)})" if size else ""))
                    result = f"Contents of {p} ({len(entries)} items):\n" + "\n".join(entries[:100])
            elif action == "read":
                if not p.is_file():
                    result = f"Not a file: {path}"
                elif p.stat().st_size > 500_000:
                    result = f"File too large ({_human_size(p.stat().st_size)}). Max 500KB."
                else:
                    text = p.read_text(encoding="utf-8", errors="replace")[:10000]
                    result = f"Contents of {p.name}:\n{text}"
            else:
                result = f"Unknown action: {action}. Use 'list' or 'read'."
        except Exception as e:
            result = f"File explorer error: {e}"
        _emit(OCEvent(type=OCEventType.TOOL_RESULT, content=result[:500], metadata={"skill": "file_explorer"}))
        return result


class OCSystemMonitorInput(BaseModel):
    info: str = Field("overview", description="'overview', 'cpu', 'memory', 'disk', or 'processes'")


class OCSystemMonitorTool(BaseTool):
    name: str = "system_monitor"
    description: str = "Check system resource usage: CPU, memory, disk, or running processes."
    args_schema: type[BaseModel] = OCSystemMonitorInput

    def _run(self, info: str = "overview") -> str:
        _emit(OCEvent(
            type=OCEventType.TOOL_CALL,
            content=f"System Monitor: {info}",
            metadata={"skill": "system_monitor", "info": info},
        ))
        try:
            import psutil
            lines = []
            if info in ("overview", "cpu"):
                lines.append(f"CPU: {psutil.cpu_percent(interval=1)}% ({psutil.cpu_count()} cores)")
            if info in ("overview", "memory"):
                mem = psutil.virtual_memory()
                lines.append(f"Memory: {mem.percent}% used ({_human_size(mem.used)} / {_human_size(mem.total)})")
            if info in ("overview", "disk"):
                disk = psutil.disk_usage("/")
                lines.append(f"Disk: {disk.percent}% used ({_human_size(disk.used)} / {_human_size(disk.total)})")
            if info in ("overview", "processes"):
                lines.append(f"System: {platform.system()} {platform.release()}")
                lines.append(f"Python: {platform.python_version()}")
            if info == "processes":
                procs = []
                for proc in psutil.process_iter(["pid", "name", "cpu_percent", "memory_percent"]):
                    try:
                        pi = proc.info
                        procs.append(pi)
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        continue
                procs.sort(key=lambda x: x.get("memory_percent", 0) or 0, reverse=True)
                lines.append("\nTop processes by memory:")
                for pi in procs[:10]:
                    lines.append(f"  PID {pi['pid']}: {pi['name']} — CPU {pi.get('cpu_percent', 0):.1f}%, Mem {pi.get('memory_percent', 0):.1f}%")
            result = "\n".join(lines)
        except ImportError:
            result = (
                f"System: {platform.system()} {platform.release()}\n"
                f"Python: {platform.python_version()}\n"
                f"Note: Install 'psutil' for detailed monitoring."
            )
        except Exception as e:
            result = f"System monitor error: {e}"
        _emit(OCEvent(type=OCEventType.TOOL_RESULT, content=result[:500], metadata={"skill": "system_monitor"}))
        return result


class OCLocalSearchInput(BaseModel):
    query: str = Field(..., description="Filename pattern or text to search for")
    search_type: str = Field("name", description="'name' to search filenames, 'content' to search file contents")
    directory: str = Field("", description="Directory to search in (must be within allowed paths)")


class OCLocalSearchTool(BaseTool):
    name: str = "local_search"
    description: str = (
        "Search for local files by name pattern or content. "
        "Use search_type='name' for filename matching, 'content' for text search."
    )
    args_schema: type[BaseModel] = OCLocalSearchInput

    def _run(self, query: str = "", search_type: str = "name", directory: str = "") -> str:
        _emit(OCEvent(
            type=OCEventType.TOOL_CALL,
            content=f"Local Search ({search_type}): {query}",
            metadata={"skill": "local_search", "query": query, "type": search_type},
        ))
        try:
            if directory:
                search_dir = Path(directory).expanduser().resolve()
                if not _is_path_allowed(search_dir):
                    result = f"Access denied: {directory} is outside allowed directories"
                    _emit(OCEvent(type=OCEventType.TOOL_RESULT, content=result, metadata={"skill": "local_search"}))
                    return result
                search_dirs = [search_dir]
            else:
                search_dirs = _get_allowed_paths()

            matches = []
            max_matches = 50
            if search_type == "name":
                pattern = query.lower()
                for sd in search_dirs:
                    if not sd.exists():
                        continue
                    for item in sd.rglob("*"):
                        if len(matches) >= max_matches:
                            break
                        if item.name.startswith("."):
                            continue
                        if pattern in item.name.lower():
                            matches.append(str(item))
            else:
                for sd in search_dirs:
                    if not sd.exists():
                        continue
                    for item in sd.rglob("*"):
                        if len(matches) >= max_matches:
                            break
                        if not item.is_file() or item.name.startswith("."):
                            continue
                        if item.stat().st_size > 1_000_000:
                            continue
                        try:
                            text = item.read_text(encoding="utf-8", errors="ignore")
                            if query.lower() in text.lower():
                                matches.append(str(item))
                        except Exception:
                            continue

            if matches:
                result = f"Found {len(matches)} matches:\n" + "\n".join(f"  {m}" for m in matches)
            else:
                result = f"No matches found for '{query}'"
        except Exception as e:
            result = f"Search error: {e}"
        _emit(OCEvent(type=OCEventType.TOOL_RESULT, content=result[:500], metadata={"skill": "local_search"}))
        return result


class OCGitStatusInput(BaseModel):
    repo_path: str = Field(..., description="Path to a git repository")
    command: str = Field("status", description="'status', 'log', 'diff', or 'branch'")


class OCGitStatusTool(BaseTool):
    name: str = "git_status"
    description: str = (
        "Check git repository status, recent log, diff, or branches. "
        "Provide the repo path and command ('status', 'log', 'diff', 'branch')."
    )
    args_schema: type[BaseModel] = OCGitStatusInput

    def _run(self, repo_path: str = "", command: str = "status") -> str:
        _emit(OCEvent(
            type=OCEventType.TOOL_CALL,
            content=f"Git {command}: {repo_path}",
            metadata={"skill": "git_status", "command": command, "repo_path": repo_path},
        ))
        try:
            p = Path(repo_path).expanduser().resolve()
            if not _is_path_allowed(p):
                result = f"Access denied: {repo_path} is outside allowed directories"
            elif not (p / ".git").is_dir():
                result = f"Not a git repository: {repo_path}"
            else:
                cmd_map = {
                    "status": ["git", "status", "--short"],
                    "log": ["git", "log", "--oneline", "-20"],
                    "diff": ["git", "diff", "--stat"],
                    "branch": ["git", "branch", "-a"],
                }
                git_cmd = cmd_map.get(command, ["git", "status", "--short"])
                proc = subprocess.run(
                    git_cmd, cwd=str(p), capture_output=True, text=True, timeout=15
                )
                result = proc.stdout or proc.stderr or "No output"
                result = f"git {command} in {p.name}:\n{result}"
        except Exception as e:
            result = f"Git error: {e}"
        _emit(OCEvent(type=OCEventType.TOOL_RESULT, content=result[:500], metadata={"skill": "git_status"}))
        return result


class OCClipboardReadInput(BaseModel):
    pass


class OCClipboardReadTool(BaseTool):
    name: str = "clipboard_read"
    description: str = "Read the current contents of the system clipboard."
    args_schema: type[BaseModel] = OCClipboardReadInput

    def _run(self) -> str:
        _emit(OCEvent(
            type=OCEventType.TOOL_CALL,
            content="Reading clipboard",
            metadata={"skill": "clipboard_read"},
        ))
        try:
            if platform.system() == "Darwin":
                proc = subprocess.run(["pbpaste"], capture_output=True, text=True, timeout=5)
                text = proc.stdout
            elif platform.system() == "Linux":
                proc = subprocess.run(["xclip", "-selection", "clipboard", "-o"], capture_output=True, text=True, timeout=5)
                text = proc.stdout
            else:
                text = "Clipboard read not supported on this OS"
            result = f"Clipboard contents:\n{text[:5000]}" if text else "Clipboard is empty"
        except Exception as e:
            result = f"Clipboard error: {e}"
        _emit(OCEvent(type=OCEventType.TOOL_RESULT, content=result[:500], metadata={"skill": "clipboard_read"}))
        return result


class OCFileWriterInput(BaseModel):
    path: str = Field(..., description="Absolute path for the file to create or edit")
    content: str = Field(..., description="Content to write to the file")
    mode: str = Field("write", description="'write' to overwrite, 'append' to add to existing file")


class OCFileWriterTool(BaseTool):
    name: str = "file_writer"
    description: str = (
        "Create or edit local files. Requires user confirmation before writing. "
        "Use mode='write' to create/overwrite, mode='append' to add content."
    )
    args_schema: type[BaseModel] = OCFileWriterInput

    def _run(self, path: str = "", content: str = "", mode: str = "write") -> str:
        _emit(OCEvent(
            type=OCEventType.TOOL_CALL,
            content=f"File Writer: {mode} {path}",
            metadata={"skill": "file_writer", "path": path, "mode": mode},
        ))
        try:
            p = Path(path).expanduser().resolve()
            if not _is_path_allowed(p):
                result = f"Access denied: {path} is outside allowed directories"
                _emit(OCEvent(type=OCEventType.TOOL_RESULT, content=result, metadata={"skill": "file_writer"}))
                return result

            approved = asyncio.run_coroutine_threadsafe(
                _request_confirmation(
                    f"File {mode}: {p.name}",
                    f"Path: {p}\nMode: {mode}\nContent length: {len(content)} chars\nPreview: {content[:200]}{'...' if len(content) > 200 else ''}"
                ),
                _main_loop
            ).result(timeout=130)

            if not approved:
                result = "Action denied by user"
            elif mode == "append":
                with open(p, "a", encoding="utf-8") as f:
                    f.write(content)
                result = f"Appended {len(content)} chars to {p.name}"
            else:
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_text(content, encoding="utf-8")
                result = f"Wrote {len(content)} chars to {p.name}"
        except Exception as e:
            result = f"File writer error: {e}"
        _emit(OCEvent(type=OCEventType.TOOL_RESULT, content=result[:500], metadata={"skill": "file_writer"}))
        return result


class OCShellRunnerInput(BaseModel):
    command: str = Field(..., description="Shell command to execute (must start with an allowed command)")
    working_directory: str = Field("", description="Working directory for the command")


class OCShellRunnerTool(BaseTool):
    name: str = "shell_runner"
    description: str = (
        "Execute shell commands on the local system. Requires user confirmation. "
        "Only allowed commands can be executed (ls, git, python, node, etc.)."
    )
    args_schema: type[BaseModel] = OCShellRunnerInput

    def _run(self, command: str = "", working_directory: str = "") -> str:
        _emit(OCEvent(
            type=OCEventType.TOOL_CALL,
            content=f"Shell: {command}",
            metadata={"skill": "shell_runner", "command": command},
        ))
        try:
            parts = command.strip().split()
            if not parts:
                result = "Empty command"
                _emit(OCEvent(type=OCEventType.TOOL_RESULT, content=result, metadata={"skill": "shell_runner"}))
                return result

            base_cmd = parts[0]
            allowed = _get_shell_allowlist()
            if base_cmd not in allowed:
                result = f"Command '{base_cmd}' is not in the allowlist. Allowed: {', '.join(allowed)}"
                _emit(OCEvent(type=OCEventType.TOOL_RESULT, content=result, metadata={"skill": "shell_runner"}))
                return result

            cwd = None
            if working_directory:
                wd = Path(working_directory).expanduser().resolve()
                if not _is_path_allowed(wd):
                    result = f"Access denied: {working_directory} is outside allowed directories"
                    _emit(OCEvent(type=OCEventType.TOOL_RESULT, content=result, metadata={"skill": "shell_runner"}))
                    return result
                cwd = str(wd)

            approved = asyncio.run_coroutine_threadsafe(
                _request_confirmation(
                    f"Run: {base_cmd}",
                    f"Command: {command}" + (f"\nDirectory: {cwd}" if cwd else "")
                ),
                _main_loop
            ).result(timeout=130)

            if not approved:
                result = "Action denied by user"
            else:
                proc = subprocess.run(
                    parts, cwd=cwd, capture_output=True, text=True, timeout=30
                )
                stdout = proc.stdout[:5000] if proc.stdout else ""
                stderr = proc.stderr[:2000] if proc.stderr else ""
                result = stdout
                if stderr:
                    result += f"\nSTDERR: {stderr}"
                if proc.returncode != 0:
                    result += f"\nExit code: {proc.returncode}"
                if not result.strip():
                    result = "Command completed (no output)"
        except Exception as e:
            result = f"Shell error: {e}"
        _emit(OCEvent(type=OCEventType.TOOL_RESULT, content=result[:500], metadata={"skill": "shell_runner"}))
        return result


class OCAppLauncherInput(BaseModel):
    target: str = Field(..., description="Application name, file path, or URL to open")


class OCAppLauncherTool(BaseTool):
    name: str = "app_launcher"
    description: str = (
        "Open applications, files, or URLs on the local system. Requires user confirmation. "
        "On macOS uses 'open', on Linux uses 'xdg-open'."
    )
    args_schema: type[BaseModel] = OCAppLauncherInput

    def _run(self, target: str = "") -> str:
        _emit(OCEvent(
            type=OCEventType.TOOL_CALL,
            content=f"Open: {target}",
            metadata={"skill": "app_launcher", "target": target},
        ))
        try:
            approved = asyncio.run_coroutine_threadsafe(
                _request_confirmation(
                    f"Open: {target[:50]}",
                    f"Target: {target}\nSystem: {platform.system()}"
                ),
                _main_loop
            ).result(timeout=130)

            if not approved:
                result = "Action denied by user"
            else:
                if platform.system() == "Darwin":
                    cmd = ["open", target]
                elif platform.system() == "Linux":
                    cmd = ["xdg-open", target]
                else:
                    cmd = ["start", target]
                subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                result = f"Opened: {target}"
        except Exception as e:
            result = f"Launch error: {e}"
        _emit(OCEvent(type=OCEventType.TOOL_RESULT, content=result[:500], metadata={"skill": "app_launcher"}))
        return result


def _get_browser_profile_dir() -> str:
    settings = get_settings()
    if settings.browser_profile_dir:
        p = Path(settings.browser_profile_dir).expanduser()
    else:
        p = Path(__file__).resolve().parent.parent.parent / "data" / "browser_profile"
    p.mkdir(parents=True, exist_ok=True)
    for lock_file in ("SingletonLock", "SingletonCookie", "SingletonSocket"):
        lock_path = p / lock_file
        if lock_path.exists():
            try:
                lock_path.unlink()
            except OSError:
                pass
    return str(p)


def _get_browser_use_llm():
    """Build a browser-use native ChatModel from current user settings."""
    from app.services.llm import get_user_settings
    s = get_user_settings()
    provider = s["provider"]

    if provider == "anthropic":
        from browser_use.llm.anthropic.chat import ChatAnthropic
        return ChatAnthropic(
            model=s["anthropic_model"],
            api_key=s["anthropic_api_key"],
            temperature=0.3,
        )
    elif provider == "groq":
        from browser_use.llm.groq.chat import ChatGroq
        return ChatGroq(
            model=s["groq_model"],
            api_key=s["groq_api_key"],
        )
    else:
        from browser_use.llm.openai.chat import ChatOpenAI
        return ChatOpenAI(
            model=s["openai_model"],
            api_key=s["openai_api_key"],
            temperature=0.3,
        )


class OCBrowserAgentInput(BaseModel):
    task: str = Field(..., description="Natural language task for the browser agent to perform (e.g. 'Go to LinkedIn and list my unread messages')")
    url: str = Field("", description="Optional starting URL to navigate to")
    max_steps: int = Field(25, description="Maximum number of browser steps (default 25)")


class OCBrowserAgentTool(BaseTool):
    name: str = "browser_agent"
    description: str = (
        "Autonomously browse any website using a real browser with your saved login sessions. "
        "Can read pages, click buttons, fill forms, extract data, send messages. "
        "Provide a task in natural language. Use browser_login first to save login sessions for new sites."
    )
    args_schema: type[BaseModel] = OCBrowserAgentInput

    def _run(self, task: str = "", url: str = "", max_steps: int = 25) -> str:
        if _is_aborted():
            return "Aborted by user."
        _emit(OCEvent(
            type=OCEventType.TOOL_CALL,
            content=f"Browser Agent: {task[:100]}",
            metadata={"skill": "browser_agent", "task": task, "url": url},
        ))
        try:
            result = _run_browser_agent_sync(task, url, max_steps)
        except Exception as e:
            result = f"Browser agent error: {e}"
        _emit(OCEvent(type=OCEventType.TOOL_RESULT, content=result[:1000], metadata={"skill": "browser_agent"}))
        return result


def _run_browser_agent_sync(task: str, url: str, max_steps: int) -> str:
    """Run browser-use Agent in a fresh event loop on the current thread."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_run_browser_agent(task, url, max_steps))
    finally:
        loop.close()


async def _run_browser_agent(task: str, url: str, max_steps: int) -> str:
    """Run the browser-use Agent with persistent session and step streaming."""
    from browser_use import Agent, BrowserSession

    profile_dir = _get_browser_profile_dir()
    full_task = task
    if url:
        full_task = f"Navigate to {url} and then: {task}"

    has_session = (Path(profile_dir) / "Default").is_dir()
    if has_session:
        full_task = (
            "IMPORTANT RULES:\n"
            "1. You are already logged in with saved browser cookies. Do NOT log in or enter credentials.\n"
            "2. Navigate directly to the relevant page URL for the task. Do NOT browse or scroll the homepage.\n"
            "3. Only interact with elements directly related to the task. IGNORE ads, banners, promotional content, and unrelated navigation.\n"
            "4. If an action fails 3 times, try an alternative approach or skip it and report what failed.\n"
            "5. Once the task is complete, IMMEDIATELY call the done action. Do NOT repeat actions you already completed.\n"
            "6. Return extracted data via the done action. Do NOT write files.\n"
            "7. Be efficient — minimize unnecessary clicks, scrolling, and navigation.\n\n"
            f"Task: {full_task}"
        )

    browser_session = BrowserSession(
        headless=False,
        user_data_dir=profile_dir,
        viewport={"width": 1280, "height": 900},
        args=["--disable-blink-features=AutomationControlled"],
    )

    llm = _get_browser_use_llm()

    async def on_step_start(agent_instance):
        if _abort_event and _abort_event.is_set():
            agent_instance.stop()

    async def on_step_end(agent_instance):
        if _abort_event and _abort_event.is_set():
            agent_instance.stop()
            return
        state = agent_instance.state
        step_info = ""
        model_out = state.last_model_output
        if model_out:
            if hasattr(model_out, "next_goal") and model_out.next_goal:
                step_info = model_out.next_goal
            elif hasattr(model_out, "thinking") and model_out.thinking:
                step_info = model_out.thinking
        if step_info:
            _emit(OCEvent(
                type=OCEventType.TOOL_CALL,
                content=f"Browser: {step_info[:200]}",
                metadata={"skill": "browser_agent", "step": "thinking"},
            ))
        results = state.last_result
        if results:
            for r in results:
                if hasattr(r, "extracted_content") and r.extracted_content:
                    _emit(OCEvent(
                        type=OCEventType.TOOL_RESULT,
                        content=r.extracted_content[:500],
                        metadata={"skill": "browser_agent", "step": "result"},
                    ))

    global _active_browser_agent, _active_browser_session
    _active_browser_session = browser_session
    agent = Agent(
        task=full_task,
        llm=llm,
        browser_session=browser_session,
        use_vision=True,
    )
    _active_browser_agent = agent

    try:
        history = await agent.run(max_steps=max_steps, on_step_start=on_step_start, on_step_end=on_step_end)
        final = history.final_result()
        if final:
            return final
        extracted = history.extracted_content()
        if extracted:
            return "\n".join(extracted)
        return "Browser task completed but no content was extracted."
    finally:
        _active_browser_agent = None
        _active_browser_session = None
        try:
            await agent.close()
        except Exception:
            pass


class OCBrowserLoginInput(BaseModel):
    url: str = Field(..., description="URL of the website to log into (e.g. 'https://www.linkedin.com')")


class OCBrowserLoginTool(BaseTool):
    name: str = "browser_login"
    description: str = (
        "Open a visible browser window so you can manually log into a website. "
        "Your session cookies will be saved and reused by browser_agent for future tasks. "
        "If a session already exists, it skips opening the browser."
    )
    args_schema: type[BaseModel] = OCBrowserLoginInput

    def _run(self, url: str = "") -> str:
        _emit(OCEvent(
            type=OCEventType.TOOL_CALL,
            content=f"Browser Login: {url}",
            metadata={"skill": "browser_login", "url": url},
        ))
        profile_dir = _get_browser_profile_dir()
        default_dir = Path(profile_dir) / "Default"
        if default_dir.is_dir() and any(default_dir.iterdir()):
            result = f"Login session already exists for this browser profile. You can use browser_agent to interact with {url} directly."
            _emit(OCEvent(type=OCEventType.TOOL_RESULT, content=result, metadata={"skill": "browser_login"}))
            return result
        try:
            result = _run_browser_login_sync(url)
        except Exception as e:
            result = f"Browser login error: {e}"
        _emit(OCEvent(type=OCEventType.TOOL_RESULT, content=result, metadata={"skill": "browser_login"}))
        return result


def _run_browser_login_sync(url: str) -> str:
    """Launch a headed browser as a detached subprocess for manual login."""
    profile_dir = _get_browser_profile_dir()
    logger.info("Browser login: profile_dir=%s, url=%s", profile_dir, url)

    script = f'''
import sys
from playwright.sync_api import sync_playwright
import time

profile_dir = {profile_dir!r}
url = {url!r}
login_url = url

pw = sync_playwright().start()
try:
    ctx = pw.chromium.launch_persistent_context(
        user_data_dir=profile_dir,
        headless=False,
        viewport={{"width": 1280, "height": 900}},
        args=["--disable-blink-features=AutomationControlled"],
    )
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.goto(url, wait_until="domcontentloaded", timeout=30000)
    print("READY", flush=True)
    for i in range(60):
        time.sleep(1)
        current = page.url
        if current != login_url and "/login" not in current and "/signin" not in current and "/checkpoint" not in current:
            time.sleep(2)
            break
    print("TITLE:" + page.title(), flush=True)
    print("URL:" + page.url, flush=True)
    ctx.close()
    print("DONE", flush=True)
finally:
    pw.stop()
'''
    import sys
    python = sys.executable
    proc = subprocess.Popen(
        [python, "-c", script],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    _emit(OCEvent(
        type=OCEventType.TOOL_RESULT,
        content=f"Browser opening at {url}. Log in and the browser will close automatically (max 60 seconds).",
        metadata={"skill": "browser_login", "step": "waiting"},
    ))

    title = url
    final_url = url
    try:
        stdout, stderr = proc.communicate(timeout=90)
        logger.info("Browser login stdout: %s", stdout.strip())
        if stderr.strip():
            logger.warning("Browser login stderr: %s", stderr.strip()[:500])
        for line in stdout.strip().split("\n"):
            if line.startswith("TITLE:"):
                title = line[6:]
            elif line.startswith("URL:"):
                final_url = line[4:]
        if proc.returncode != 0:
            return f"Browser login failed (exit {proc.returncode}). Check that Chromium is installed: playwright install chromium"
    except subprocess.TimeoutExpired:
        proc.kill()
        return "Browser login timed out."

    return f"Login session saved. Final page: '{title}' at {final_url}. You can now use browser_agent to interact with this site."


def _human_size(size: int) -> str:
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if size < 1024:
            return f"{size:.1f}{unit}"
        size /= 1024
    return f"{size:.1f}PB"


SKILL_TOOL_MAP: dict[str, type[BaseTool]] = {
    "web_search": OCWebSearchTool,
    "calculator": OCCalculatorTool,
    "memory": OCMemoryTool,
    "url_fetcher": OCUrlFetcherTool,
    "text_analyzer": OCTextAnalyzerTool,
    "note_taker": OCNoteTakerTool,
    "send_email": OCSendEmailTool,
    "file_generator": OCFileGeneratorTool,
    "file_explorer": OCFileExplorerTool,
    "system_monitor": OCSystemMonitorTool,
    "local_search": OCLocalSearchTool,
    "git_status": OCGitStatusTool,
    "clipboard_read": OCClipboardReadTool,
    "file_writer": OCFileWriterTool,
    "shell_runner": OCShellRunnerTool,
    "app_launcher": OCAppLauncherTool,
    "browser_agent": OCBrowserAgentTool,
    "browser_login": OCBrowserLoginTool,
}


def _build_conversation_context(messages: list[ChatMessage]) -> str:
    lines = []
    for msg in messages[:-1]:
        prefix = "User" if msg.role == "user" else "Assistant"
        lines.append(f"{prefix}: {msg.content}")
    return "\n".join(lines)


async def stream_chat(request: ChatRequest) -> AsyncGenerator[str, None]:
    """Execute a single-agent chat turn with skill usage, streaming events via SSE."""
    global _event_queue, _main_loop, _memory_store, _notes_store, _search_cache, _abort_event, _session_id
    _event_queue = asyncio.Queue(maxsize=500)
    _main_loop = asyncio.get_running_loop()
    _notes_store = {}
    _search_cache = {}
    _abort_event = threading.Event()
    _session_id = str(uuid.uuid4())[:8]

    if request.memory:
        _memory_store = dict(request.memory)
    else:
        _memory_store = {}

    start_time = time.time()
    total_skill_calls = 0

    try:
        yield f"data: {json.dumps(OCEvent(type=OCEventType.GATEWAY_STATUS, content='processing', metadata={'skills_active': sum(1 for s in request.skills if s.enabled), 'session_id': _session_id}).model_dump())}\n\n"

        llm = get_llm()
        date_context = f"Today's date is {datetime.now().strftime('%B %d, %Y')}."

        enabled_skills = [s for s in request.skills if s.enabled and s.id in SKILL_TOOL_MAP]
        tools = [SKILL_TOOL_MAP[s.id]() for s in enabled_skills]
        enabled_ids = {s.id for s in enabled_skills}

        soul = request.soul.strip() if request.soul else (
            "You are a helpful, knowledgeable AI assistant. "
            "You are direct, thoughtful, and thorough in your responses."
        )

        backstory = f"{date_context} {soul}"

        tool_routing: list[str] = []
        if "browser_agent" in enabled_ids:
            tool_routing.append(
                "CRITICAL: When the user asks you to visit, open, browse, read from, or interact with "
                "a specific website (LinkedIn, Gmail, Slack, Amazon, Google, etc.), you MUST use the "
                "browser_agent tool. Do NOT answer from your own knowledge. Do NOT give generic tips. "
                "Actually launch the browser and perform the task on the real website. "
                "Use web_search only for general information queries, not for site-specific tasks."
            )
        if "browser_login" in enabled_ids:
            tool_routing.append(
                "If the browser_agent fails because you are not logged in, tell the user to use "
                "the browser_login skill first to save their session."
            )
        if "file_explorer" in enabled_ids or "local_search" in enabled_ids:
            tool_routing.append(
                "When the user asks about local files or directories, use file_explorer or local_search "
                "instead of guessing."
            )
        if tool_routing:
            backstory += "\n\nTool usage rules:\n" + "\n".join(f"- {r}" for r in tool_routing)

        if _memory_store:
            memory_context = "\n".join(f"- {k}: {v}" for k, v in _memory_store.items())
            backstory += f"\n\nYour persistent memories:\n{memory_context}"

        goal = "Help the user accomplish their request using available skills."
        if "browser_agent" in enabled_ids:
            goal += " When the user asks to interact with a website, use browser_agent to actually browse it."

        agent = Agent(
            role="Personal AI Assistant",
            goal=goal,
            backstory=backstory,
            tools=tools,
            llm=llm,
            verbose=False,
        )

        user_message = request.messages[-1].content if request.messages else ""
        conversation = _build_conversation_context(request.messages)

        task_description = user_message
        if conversation:
            task_description = (
                f"Previous conversation:\n{conversation}\n\n"
                f"Current user message: {user_message}"
            )

        task = Task(
            description=task_description,
            expected_output="A helpful, complete response to the user's request.",
            agent=agent,
        )

        crew = Crew(
            agents=[agent],
            tasks=[task],
            process=Process.sequential,
            verbose=False,
        )

        result_task = asyncio.ensure_future(asyncio.to_thread(crew.kickoff))

        done = False
        aborted = False
        while not done:
            if _abort_event and _abort_event.is_set():
                result_task.cancel()
                aborted = True
                break
            try:
                event = await asyncio.wait_for(_event_queue.get(), timeout=0.5)
                if event.type == OCEventType.TOOL_CALL:
                    total_skill_calls += 1
                yield f"data: {json.dumps(event.model_dump())}\n\n"
            except (asyncio.TimeoutError, TimeoutError):
                if result_task.done():
                    while not _event_queue.empty():
                        event = _event_queue.get_nowait()
                        if event.type == OCEventType.TOOL_CALL:
                            total_skill_calls += 1
                        yield f"data: {json.dumps(event.model_dump())}\n\n"
                    done = True

        if aborted:
            elapsed = time.time() - start_time
            yield f"data: {json.dumps(OCEvent(type=OCEventType.RESPONSE, content='Execution stopped by user.', metadata={'execution_time_seconds': round(elapsed, 1), 'total_skill_calls': total_skill_calls, 'aborted': True}).model_dump())}\n\n"
            yield f"data: {json.dumps(OCEvent(type=OCEventType.GATEWAY_STATUS, content='idle').model_dump())}\n\n"
        else:
            result = await result_task
            elapsed = time.time() - start_time

            yield f"data: {json.dumps(OCEvent(type=OCEventType.RESPONSE, content=str(result), metadata={'execution_time_seconds': round(elapsed, 1), 'total_skill_calls': total_skill_calls}).model_dump())}\n\n"

            if _memory_store:
                yield f"data: {json.dumps(OCEvent(type=OCEventType.MEMORY_UPDATE, content='sync', metadata={'memory': _memory_store}).model_dump())}\n\n"

            yield f"data: {json.dumps(OCEvent(type=OCEventType.GATEWAY_STATUS, content='idle').model_dump())}\n\n"

    except Exception as e:
        logger.exception("OpenClaw chat failed")
        yield f"data: {json.dumps(OCEvent(type=OCEventType.ERROR, content=str(e)).model_dump())}\n\n"
        yield f"data: {json.dumps(OCEvent(type=OCEventType.GATEWAY_STATUS, content='error').model_dump())}\n\n"
    finally:
        _event_queue = None
        _abort_event = None
        _session_id = None
        _active_browser_agent = None
        _active_browser_session = None
        _notes_store = {}
        _search_cache = {}
        _confirmation_events.clear()
        _confirmation_results.clear()

    yield "data: [DONE]\n\n"
