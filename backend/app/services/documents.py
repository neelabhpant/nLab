"""Document processing pipeline with LLM-powered extraction."""

import base64
import json
import logging
import time
import uuid
from pathlib import Path
from typing import Any

import fitz
from docx import Document as DocxDocument

from app.services.llm import get_llm, get_user_settings

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
UPLOADS_DIR = DATA_DIR / "uploads"
DOCUMENTS_META_PATH = DATA_DIR / "documents.json"

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".png", ".jpg", ".jpeg"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg"}

EXTRACTION_PROMPT = """You are a financial document analyst. Analyze the following document content and extract structured financial information.

Return a JSON object with these fields:
{
  "document_type": "tax_return | bank_statement | pay_stub | investment_statement | credit_card_statement | insurance_document | loan_document | other",
  "summary": "2-3 sentence summary of the document",
  "financial_data": {
    "income": { ... any income figures found },
    "expenses": { ... any expense figures found },
    "assets": { ... any asset/account balances found },
    "debts": { ... any debt/liability figures found },
    "taxes": { ... any tax-related figures found },
    "other": { ... any other financial data points }
  },
  "profile_updates": {
    "section": "the profile section this data should update (personal, income, expenses, assets, debts, goals)",
    "data": { ... the structured data to merge into the profile }
  },
  "notable_items": ["list of anything noteworthy, unusual, or requiring attention"]
}

Only include fields where you found actual data. Be precise with numbers. If the document is not financial, set document_type to "other" and describe what it contains."""

CHUNK_SIZE = 500
CHUNK_OVERLAP = 50


def _get_chroma_collection():
    """Get or create the ChromaDB collection for financial documents."""
    import chromadb

    chroma_dir = DATA_DIR / "chroma"
    chroma_dir.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(path=str(chroma_dir))
    return client.get_or_create_collection(
        name="financial_documents",
        metadata={"hnsw:space": "cosine"},
    )


def _extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text from PDF using PyMuPDF."""
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    pages = []
    for page in doc:
        text = page.get_text()
        if text.strip():
            pages.append(text)
    doc.close()
    return "\n\n--- Page Break ---\n\n".join(pages)


def _extract_text_from_docx(file_bytes: bytes) -> str:
    """Extract text from DOCX."""
    import io
    doc = DocxDocument(io.BytesIO(file_bytes))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())


def _chunk_text(text: str) -> list[str]:
    """Split text into chunks of ~CHUNK_SIZE tokens with overlap."""
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = start + CHUNK_SIZE
        chunk = " ".join(words[start:end])
        if chunk.strip():
            chunks.append(chunk)
        start = end - CHUNK_OVERLAP
    return chunks if chunks else [text[:2000]]


def _llm_extract(content: str, is_image: bool = False, image_b64: str | None = None) -> dict[str, Any]:
    """Send content to the LLM for structured extraction."""
    from litellm import completion

    settings = get_user_settings()
    provider = settings["provider"]

    if provider == "anthropic":
        model = f"anthropic/{settings['anthropic_model']}"
        api_key = settings["anthropic_api_key"]
    else:
        model = f"openai/{settings['openai_model']}"
        api_key = settings["openai_api_key"]

    messages: list[dict[str, Any]] = []

    if is_image and image_b64:
        messages.append({
            "role": "user",
            "content": [
                {"type": "text", "text": EXTRACTION_PROMPT},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{image_b64}"},
                },
            ],
        })
    else:
        messages.append({
            "role": "user",
            "content": f"{EXTRACTION_PROMPT}\n\nDocument content:\n{content[:8000]}",
        })

    try:
        response = completion(
            model=model,
            messages=messages,
            api_key=api_key,
            temperature=0.1,
            max_tokens=2000,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start >= 0 and end > start:
            json_str = raw[start:end]
            try:
                return json.loads(json_str)
            except json.JSONDecodeError:
                import re
                cleaned = re.sub(r',\s*}', '}', json_str)
                cleaned = re.sub(r',\s*]', ']', cleaned)
                try:
                    return json.loads(cleaned)
                except json.JSONDecodeError:
                    logger.warning("Failed to parse LLM JSON, returning raw summary")
                    return {"document_type": "other", "summary": raw[:500], "financial_data": {}, "notable_items": []}
        return {"document_type": "other", "summary": raw[:500], "financial_data": {}, "notable_items": []}
    except Exception as e:
        logger.exception("LLM extraction failed")
        return {"document_type": "unknown", "summary": f"Extraction failed: {e}", "financial_data": {}, "notable_items": []}


def _load_documents_meta() -> list[dict]:
    """Load document metadata list."""
    if DOCUMENTS_META_PATH.exists():
        try:
            return json.loads(DOCUMENTS_META_PATH.read_text())
        except (json.JSONDecodeError, OSError):
            pass
    return []


def _save_documents_meta(docs: list[dict]) -> None:
    """Persist document metadata."""
    DOCUMENTS_META_PATH.parent.mkdir(parents=True, exist_ok=True)
    DOCUMENTS_META_PATH.write_text(json.dumps(docs, indent=2))


async def process_document(filename: str, file_bytes: bytes) -> dict[str, Any]:
    """Process an uploaded document through the extraction pipeline.

    Args:
        filename: Original filename with extension.
        file_bytes: Raw file content.

    Returns:
        Extraction result with document type, summary, financial data, and profile updates.
    """
    import asyncio

    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported file type: {ext}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    doc_id = str(uuid.uuid4())[:8]
    safe_name = f"{doc_id}_{filename}"
    save_path = UPLOADS_DIR / safe_name
    save_path.write_bytes(file_bytes)

    text = ""
    is_image = ext in IMAGE_EXTENSIONS
    image_b64 = None

    if ext == ".pdf":
        text = await asyncio.to_thread(_extract_text_from_pdf, file_bytes)
    elif ext == ".docx":
        text = await asyncio.to_thread(_extract_text_from_docx, file_bytes)
    elif ext == ".txt":
        text = file_bytes.decode("utf-8", errors="replace")
    elif is_image:
        image_b64 = base64.b64encode(file_bytes).decode("utf-8")

    extraction = await asyncio.to_thread(
        _llm_extract,
        text,
        is_image,
        image_b64,
    )

    chunk_text = text if text else extraction.get("summary", "")
    if chunk_text:
        chunks = _chunk_text(chunk_text)
        collection = _get_chroma_collection()
        ids = [f"{doc_id}_chunk_{i}" for i in range(len(chunks))]
        metadatas = [{"doc_id": doc_id, "filename": filename, "chunk_index": i} for i in range(len(chunks))]
        collection.add(documents=chunks, ids=ids, metadatas=metadatas)

    doc_meta = {
        "id": doc_id,
        "filename": filename,
        "stored_as": safe_name,
        "document_type": extraction.get("document_type", "unknown"),
        "summary": extraction.get("summary", ""),
        "uploaded_at": int(time.time()),
    }
    docs = _load_documents_meta()
    docs.append(doc_meta)
    _save_documents_meta(docs)

    from app.services.user_profile import update_profile as _update_profile

    profile_updates = extraction.get("profile_updates")
    if isinstance(profile_updates, dict) and profile_updates.get("section") and profile_updates.get("data"):
        try:
            _update_profile(profile_updates["section"], profile_updates["data"])
        except Exception:
            logger.warning("Failed to apply profile updates from document extraction")

    financial_data = extraction.get("financial_data", {})
    if isinstance(financial_data, dict):
        for section_key, mapping in [
            ("income", "income"),
            ("expenses", "expenses"),
        ]:
            section_data = financial_data.get(section_key)
            if isinstance(section_data, dict) and section_data:
                try:
                    _update_profile(mapping, section_data)
                except Exception:
                    pass

        assets_data = financial_data.get("assets")
        if isinstance(assets_data, dict) and assets_data:
            accounts = []
            for k, v in assets_data.items():
                if isinstance(v, (int, float)) and v > 0:
                    accounts.append({"name": k, "type": "account", "balance": v})
            if accounts:
                try:
                    from app.services.user_profile import get_profile as _get_profile
                    existing = _get_profile().get("assets", {}).get("accounts", [])
                    existing_names = {a.get("name", "").lower() for a in existing}
                    for acc in accounts:
                        if acc["name"].lower() not in existing_names:
                            existing.append(acc)
                    _update_profile("assets", {"accounts": existing})
                except Exception:
                    pass

    return {
        "id": doc_id,
        "filename": filename,
        "document_type": extraction.get("document_type", "unknown"),
        "summary": extraction.get("summary", ""),
        "financial_data": extraction.get("financial_data", {}),
        "profile_updates": extraction.get("profile_updates"),
        "notable_items": extraction.get("notable_items", []),
    }


def search_documents(query: str, n_results: int = 5) -> list[dict]:
    """Search the document vector store for relevant chunks.

    Args:
        query: Natural language search query.
        n_results: Number of results to return.

    Returns:
        List of dicts with 'content', 'filename', and 'doc_id'.
    """
    collection = _get_chroma_collection()
    if collection.count() == 0:
        return []

    results = collection.query(query_texts=[query], n_results=min(n_results, collection.count()))
    items = []
    for i, doc in enumerate(results["documents"][0]):
        meta = results["metadatas"][0][i] if results["metadatas"] else {}
        items.append({
            "content": doc,
            "filename": meta.get("filename", "unknown"),
            "doc_id": meta.get("doc_id", "unknown"),
        })
    return items


def list_documents() -> list[dict]:
    """Return metadata for all uploaded documents."""
    return _load_documents_meta()
