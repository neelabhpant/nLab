"""Vault semantic memory — ChromaDB + OpenAI embeddings for document search."""

import logging
from typing import Any

import chromadb
from openai import OpenAI

from app.services.llm import get_user_settings
from app.services.vault_storage import VAULT_DATA_PATH

logger = logging.getLogger(__name__)

CHROMA_PATH = str(VAULT_DATA_PATH / "chroma")
COLLECTION_NAME = "nlab_vault"
EMBEDDING_MODEL = "text-embedding-3-small"
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50


def _chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping word-based chunks."""
    words = text.split()
    if not words:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        if chunk.strip():
            chunks.append(chunk)
        start = end - overlap if end < len(words) else len(words)
    return chunks


def _get_embeddings(texts: list[str], api_key: str) -> list[list[float]]:
    """Get embeddings from OpenAI."""
    client = OpenAI(api_key=api_key)
    response = client.embeddings.create(model=EMBEDDING_MODEL, input=texts)
    return [item.embedding for item in response.data]


class VaultMemory:
    """ChromaDB-backed semantic memory for vault documents.

    Always uses OpenAI text-embedding-3-small for embeddings regardless of
    the user's chat LLM provider selection.

    Gracefully degrades when OpenAI API key is unavailable.
    """

    def __init__(self) -> None:
        self._collection = None
        self._api_key: str | None = None
        try:
            settings = get_user_settings()
            api_key = settings.get("openai_api_key")
            if not api_key:
                logger.warning("No OpenAI API key — vault semantic search unavailable")
                return

            VAULT_DATA_PATH.mkdir(parents=True, exist_ok=True)
            client = chromadb.PersistentClient(path=CHROMA_PATH)
            self._collection = client.get_or_create_collection(
                name=COLLECTION_NAME,
                metadata={"hnsw:space": "cosine"},
            )
            self._api_key = api_key
            logger.info("Vault ChromaDB memory initialized at %s", CHROMA_PATH)
        except Exception as e:
            logger.warning("ChromaDB initialization failed (%s) — running without semantic memory", e)

    @property
    def available(self) -> bool:
        """Whether semantic memory is available."""
        return self._collection is not None and self._api_key is not None

    def add_document(
        self,
        doc_id: str,
        title: str,
        summary: str,
        key_facts: list[str],
        entities: list[dict[str, Any]],
        raw_text: str,
        user_id: str,
    ) -> None:
        """Chunk and embed a document into ChromaDB."""
        if not self._collection or not self._api_key:
            return

        facts_str = "\n".join(f"- {f}" for f in key_facts) if key_facts else ""
        entities_str = "\n".join(
            f"- {e.get('name', '')}: {e.get('value', '')} ({e.get('type', '')})"
            for e in entities
        ) if entities else ""

        preamble = f"Title: {title}\nSummary: {summary}"
        if facts_str:
            preamble += f"\nKey Facts:\n{facts_str}"
        if entities_str:
            preamble += f"\nEntities:\n{entities_str}"

        full_text = f"{preamble}\n\nContent:\n{raw_text}" if raw_text else preamble
        chunks = _chunk_text(full_text)
        if not chunks:
            return

        try:
            embeddings = _get_embeddings(chunks, self._api_key)

            ids = [f"{doc_id}_{i}" for i in range(len(chunks))]
            metadatas = [
                {"doc_id": doc_id, "title": title, "user_id": user_id, "chunk_index": i}
                for i in range(len(chunks))
            ]

            self._collection.add(
                ids=ids,
                embeddings=embeddings,
                documents=chunks,
                metadatas=metadatas,
            )
            logger.info("Added %d chunks for doc %s", len(chunks), doc_id)
        except Exception:
            logger.warning("Failed to embed doc %s", doc_id)

    def search(self, query: str, user_id: str, limit: int = 10) -> list[dict[str, Any]]:
        """Search ChromaDB for relevant document chunks."""
        if not self._collection or not self._api_key:
            return []
        try:
            query_embedding = _get_embeddings([query], self._api_key)[0]
            results = self._collection.query(
                query_embeddings=[query_embedding],
                n_results=limit,
                where={"user_id": user_id},
            )

            output: list[dict[str, Any]] = []
            if results and results.get("documents"):
                docs = results["documents"][0]
                metas = results["metadatas"][0] if results.get("metadatas") else [{}] * len(docs)
                for doc_text, meta in zip(docs, metas):
                    output.append({
                        "text": doc_text,
                        "metadata": meta,
                    })
            return output
        except Exception:
            logger.warning("ChromaDB search failed")
            return []

    def delete_document(self, doc_id: str, user_id: str) -> None:
        """Remove all chunks for a document from ChromaDB."""
        if not self._collection:
            return
        try:
            self._collection.delete(where={"doc_id": doc_id})
        except Exception:
            logger.warning("ChromaDB delete failed for doc %s", doc_id)
