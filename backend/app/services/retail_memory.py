"""Retail semantic memory — ChromaDB vector store for retail intelligence."""

import logging
from pathlib import Path
from typing import Any

import chromadb
from openai import OpenAI

from app.services.llm import get_user_settings

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
CHROMA_PATH = str(DATA_DIR / "retail_chroma")
COLLECTION_NAME = "retail_intelligence"
EMBEDDING_MODEL = "text-embedding-3-small"
CHUNK_SIZE = 400
CHUNK_OVERLAP = 40


def _chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
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
    client = OpenAI(api_key=api_key)
    response = client.embeddings.create(model=EMBEDDING_MODEL, input=texts)
    return [item.embedding for item in response.data]


class RetailMemory:
    def __init__(self) -> None:
        self._collection = None
        self._api_key: str | None = None
        try:
            settings = get_user_settings()
            api_key = settings.get("openai_api_key")
            if not api_key:
                logger.warning("No OpenAI API key — retail semantic search unavailable")
                return

            Path(CHROMA_PATH).parent.mkdir(parents=True, exist_ok=True)
            client = chromadb.PersistentClient(path=CHROMA_PATH)
            self._collection = client.get_or_create_collection(
                name=COLLECTION_NAME,
                metadata={"hnsw:space": "cosine"},
            )
            self._api_key = api_key
            logger.info("Retail ChromaDB memory initialized at %s", CHROMA_PATH)
        except Exception as e:
            logger.warning("Retail ChromaDB init failed (%s) — running without semantic memory", e)

    @property
    def available(self) -> bool:
        return self._collection is not None and self._api_key is not None

    def embed_article(
        self,
        article_id: str,
        title: str,
        source_id: str,
        summary: str,
        tags: list[str],
        sparks: list[dict[str, Any]],
        relevance_score: float | None = None,
    ) -> None:
        if not self._collection or not self._api_key:
            return

        text_parts = [f"Title: {title}", f"Summary: {summary}"]
        if tags:
            text_parts.append(f"Tags: {', '.join(tags)}")
        for spark in sparks:
            text_parts.append(
                f"Use Case: {spark.get('title', '')} — {spark.get('description', '')}"
            )
        full_text = "\n".join(text_parts)
        chunks = _chunk_text(full_text)
        if not chunks:
            return

        try:
            embeddings = _get_embeddings(chunks, self._api_key)
            ids = [f"{article_id}_{i}" for i in range(len(chunks))]
            metadatas = [
                {
                    "article_id": article_id,
                    "title": title,
                    "source_id": source_id,
                    "relevance_score": relevance_score or 0.0,
                    "chunk_index": i,
                }
                for i in range(len(chunks))
            ]
            self._collection.add(
                ids=ids,
                embeddings=embeddings,
                documents=chunks,
                metadatas=metadatas,
            )
            logger.info("Embedded %d chunks for article %s", len(chunks), article_id)
        except Exception:
            logger.warning("Failed to embed article %s", article_id)

    def search(self, query: str, n_results: int = 8) -> list[dict[str, Any]]:
        if not self._collection or not self._api_key:
            return []
        try:
            query_embedding = _get_embeddings([query], self._api_key)[0]
            results = self._collection.query(
                query_embeddings=[query_embedding],
                n_results=n_results,
            )
            output: list[dict[str, Any]] = []
            if results and results.get("documents"):
                docs = results["documents"][0]
                metas = results["metadatas"][0] if results.get("metadatas") else [{}] * len(docs)
                for doc_text, meta in zip(docs, metas):
                    output.append({"text": doc_text, "metadata": meta})
            return output
        except Exception:
            logger.warning("Retail ChromaDB search failed")
            return []

    def delete_article(self, article_id: str) -> None:
        if not self._collection:
            return
        try:
            self._collection.delete(where={"article_id": article_id})
        except Exception:
            logger.warning("ChromaDB delete failed for article %s", article_id)
