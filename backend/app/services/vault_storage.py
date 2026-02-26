"""Vault document storage backed by SQLite."""

import json
import logging
import os
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import aiosqlite

logger = logging.getLogger(__name__)

_DEFAULT_VAULT_PATH = str(
    Path(__file__).resolve().parent.parent.parent / "data" / "vault"
)
VAULT_DATA_PATH = Path(os.getenv("VAULT_DATA_PATH", _DEFAULT_VAULT_PATH))
DB_PATH = VAULT_DATA_PATH / "vault.db"
FILES_DIR = VAULT_DATA_PATH / "files"

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER,
    doc_type TEXT,
    title TEXT,
    summary TEXT,
    raw_text TEXT,
    entities_json TEXT,
    key_facts_json TEXT,
    status TEXT DEFAULT 'pending',
    error_message TEXT,
    user_email TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""


class VaultStorage:
    """Async SQLite storage for vault document metadata."""

    async def init_db(self) -> None:
        """Create the documents table if it doesn't exist."""
        VAULT_DATA_PATH.mkdir(parents=True, exist_ok=True)
        FILES_DIR.mkdir(parents=True, exist_ok=True)
        async with aiosqlite.connect(str(DB_PATH)) as db:
            await db.execute(CREATE_TABLE_SQL)
            await db.commit()
        logger.info("Vault database initialized at %s", DB_PATH)

    async def save_document(
        self,
        filename: str,
        file_bytes: bytes,
        user_email: str,
    ) -> str:
        """Save a file to disk and create a metadata record.

        Returns the document id.
        """
        doc_id = str(uuid.uuid4())
        ext = Path(filename).suffix.lower().lstrip(".")
        file_dir = FILES_DIR / doc_id
        file_dir.mkdir(parents=True, exist_ok=True)
        file_path = file_dir / filename
        file_path.write_bytes(file_bytes)

        async with aiosqlite.connect(str(DB_PATH)) as db:
            await db.execute(
                """
                INSERT INTO documents (id, filename, file_path, file_type, file_size, status, user_email)
                VALUES (?, ?, ?, ?, ?, 'pending', ?)
                """,
                (doc_id, filename, str(file_path), ext, len(file_bytes), user_email),
            )
            await db.commit()
        return doc_id

    async def get_document(self, doc_id: str) -> dict[str, Any] | None:
        """Return full document metadata or None."""
        async with aiosqlite.connect(str(DB_PATH)) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM documents WHERE id = ?", (doc_id,))
            row = await cursor.fetchone()
            if not row:
                return None
            return _row_to_dict(row)

    async def list_documents(
        self,
        user_email: str,
        doc_type: str | None = None,
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """Return paginated document list (without raw_text)."""
        query = (
            "SELECT id, filename, file_type, file_size, doc_type, title, summary, "
            "status, error_message, user_email, created_at, updated_at "
            "FROM documents WHERE user_email = ?"
        )
        params: list[Any] = [user_email]

        if doc_type:
            query += " AND doc_type = ?"
            params.append(doc_type)
        if search:
            query += " AND (title LIKE ? OR summary LIKE ? OR raw_text LIKE ?)"
            like = f"%{search}%"
            params.extend([like, like, like])

        query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        async with aiosqlite.connect(str(DB_PATH)) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(query, params)
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def update_document(self, doc_id: str, updates: dict[str, Any]) -> None:
        """Update specific fields on a document record."""
        allowed = {
            "doc_type", "title", "summary", "raw_text",
            "entities_json", "key_facts_json", "status", "error_message",
        }
        filtered = {k: v for k, v in updates.items() if k in allowed}
        if not filtered:
            return

        filtered["updated_at"] = datetime.now(timezone.utc).isoformat()
        set_clause = ", ".join(f"{k} = ?" for k in filtered)
        values = list(filtered.values()) + [doc_id]

        async with aiosqlite.connect(str(DB_PATH)) as db:
            await db.execute(
                f"UPDATE documents SET {set_clause} WHERE id = ?",
                values,
            )
            await db.commit()

    async def delete_document(self, doc_id: str) -> None:
        """Delete a document record and its files."""
        async with aiosqlite.connect(str(DB_PATH)) as db:
            await db.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
            await db.commit()

        file_dir = FILES_DIR / doc_id
        if file_dir.exists():
            shutil.rmtree(file_dir)

    async def get_stats(self, user_email: str) -> dict[str, Any]:
        """Return aggregate stats for a user's vault."""
        async with aiosqlite.connect(str(DB_PATH)) as db:
            cursor = await db.execute(
                "SELECT COUNT(*) FROM documents WHERE user_email = ?",
                (user_email,),
            )
            total = (await cursor.fetchone())[0]

            cursor = await db.execute(
                "SELECT doc_type, COUNT(*) as cnt FROM documents "
                "WHERE user_email = ? GROUP BY doc_type",
                (user_email,),
            )
            by_type = {row[0] or "unclassified": row[1] for row in await cursor.fetchall()}

            cursor = await db.execute(
                "SELECT COALESCE(SUM(file_size), 0) FROM documents WHERE user_email = ?",
                (user_email,),
            )
            total_size = (await cursor.fetchone())[0]

        return {"total": total, "by_type": by_type, "total_size": total_size}

    async def search_text(
        self,
        user_email: str,
        query: str,
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        """Simple text search across title, summary, and raw_text."""
        like = f"%{query}%"
        async with aiosqlite.connect(str(DB_PATH)) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT id, filename, title, summary, doc_type, "
                "SUBSTR(raw_text, 1, 500) as snippet "
                "FROM documents WHERE user_email = ? "
                "AND (title LIKE ? OR summary LIKE ? OR raw_text LIKE ?) "
                "ORDER BY created_at DESC LIMIT ?",
                (user_email, like, like, like, limit),
            )
            return [dict(r) for r in await cursor.fetchall()]


def _row_to_dict(row: aiosqlite.Row) -> dict[str, Any]:
    """Convert a Row to a dict, parsing JSON fields."""
    d = dict(row)
    for key in ("entities_json", "key_facts_json"):
        if d.get(key):
            try:
                d[key] = json.loads(d[key])
            except (json.JSONDecodeError, TypeError):
                pass
    return d
