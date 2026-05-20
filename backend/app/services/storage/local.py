"""LocalStorageBackend — SQLite for tables, filesystem for blobs."""

import json
import logging
from pathlib import Path
from typing import Optional

import aiosqlite

from .base import StorageBackend

logger = logging.getLogger(__name__)

STORAGE_ROOT = Path(__file__).resolve().parent.parent.parent.parent / "data" / "newsletter"
DB_PATH = STORAGE_ROOT / "newsletter.db"
SCHEMA_PATH = Path(__file__).resolve().parent / "schema.sql"


# Per-table metadata: id column + columns whose values are JSON-encoded blobs.
# Keys must match the table names in schema.sql.
TABLE_META: dict[str, dict] = {
    "newsletter_drafts": {
        "id_col": "id",
        "json_cols": {"content_json"},
    },
    "newsletter_issues": {
        "id_col": "id",
        "json_cols": {"content_json"},
    },
    "pov_library": {
        "id_col": "id",
        "json_cols": {"target_accounts", "tags"},
    },
    "voice_examples": {
        "id_col": "id",
        "json_cols": set(),
    },
    "distribution_lists": {
        "id_col": "id",
        "json_cols": {"recipients_json"},
    },
}


class LocalStorageBackend(StorageBackend):
    """v1 backend. Async SQLite via aiosqlite + local filesystem."""

    def __init__(self, storage_root: Optional[Path] = None) -> None:
        self.storage_root = Path(storage_root) if storage_root else STORAGE_ROOT
        self.db_path = self.storage_root / "newsletter.db"
        self._initialised = False

    async def _ensure_initialised(self) -> None:
        if self._initialised:
            return
        self.storage_root.mkdir(parents=True, exist_ok=True)
        schema_sql = SCHEMA_PATH.read_text()
        async with aiosqlite.connect(str(self.db_path)) as db:
            await db.executescript(schema_sql)
            await db.commit()
        self._initialised = True

    @staticmethod
    def _table_meta(table: str) -> dict:
        if table not in TABLE_META:
            raise ValueError(f"Unknown table: {table}")
        return TABLE_META[table]

    @staticmethod
    def _serialise(value: dict, json_cols: set[str]) -> dict:
        out = {}
        for k, v in value.items():
            if k in json_cols and not isinstance(v, (str, type(None))):
                out[k] = json.dumps(v)
            elif isinstance(v, bool):
                out[k] = 1 if v else 0
            else:
                out[k] = v
        return out

    @staticmethod
    def _deserialise(row: dict, json_cols: set[str]) -> dict:
        out = dict(row)
        for c in json_cols:
            raw = out.get(c)
            if raw is None or raw == "":
                continue
            try:
                out[c] = json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                pass
        return out

    async def get(self, table: str, key: str) -> Optional[dict]:
        await self._ensure_initialised()
        meta = self._table_meta(table)
        id_col = meta["id_col"]
        async with aiosqlite.connect(str(self.db_path)) as db:
            db.row_factory = aiosqlite.Row
            cur = await db.execute(
                f"SELECT * FROM {table} WHERE {id_col} = ?", (key,)
            )
            row = await cur.fetchone()
        if not row:
            return None
        return self._deserialise(dict(row), meta["json_cols"])

    async def put(self, table: str, key: str, value: dict) -> None:
        await self._ensure_initialised()
        meta = self._table_meta(table)
        id_col = meta["id_col"]
        json_cols = meta["json_cols"]

        row = {**value, id_col: key}
        serialised = self._serialise(row, json_cols)

        cols = list(serialised.keys())
        placeholders = ", ".join(["?"] * len(cols))
        col_names = ", ".join(cols)
        vals = [serialised[c] for c in cols]

        async with aiosqlite.connect(str(self.db_path)) as db:
            await db.execute(
                f"INSERT OR REPLACE INTO {table} ({col_names}) VALUES ({placeholders})",
                vals,
            )
            await db.commit()

    async def delete(self, table: str, key: str) -> None:
        await self._ensure_initialised()
        meta = self._table_meta(table)
        id_col = meta["id_col"]
        async with aiosqlite.connect(str(self.db_path)) as db:
            await db.execute(
                f"DELETE FROM {table} WHERE {id_col} = ?", (key,)
            )
            await db.commit()

    async def list(self, table: str, prefix: Optional[str] = None) -> list[dict]:
        await self._ensure_initialised()
        meta = self._table_meta(table)
        id_col = meta["id_col"]
        async with aiosqlite.connect(str(self.db_path)) as db:
            db.row_factory = aiosqlite.Row
            if prefix is None:
                cur = await db.execute(f"SELECT * FROM {table}")
            else:
                cur = await db.execute(
                    f"SELECT * FROM {table} WHERE {id_col} LIKE ?",
                    (f"{prefix}%",),
                )
            rows = await cur.fetchall()
        return [self._deserialise(dict(r), meta["json_cols"]) for r in rows]

    def _resolve_file_path(self, path: str) -> Path:
        # Defend against path traversal — resolved file must stay inside storage_root.
        rel = Path(path)
        if rel.is_absolute():
            raise ValueError("File paths must be relative to the storage root")
        target = (self.storage_root / rel).resolve()
        root = self.storage_root.resolve()
        if root not in target.parents and target != root:
            raise ValueError("File path escapes storage root")
        return target

    async def store_file(self, path: str, data: bytes) -> str:
        await self._ensure_initialised()
        target = self._resolve_file_path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        return str(target)

    async def get_file(self, path: str) -> bytes:
        target = self._resolve_file_path(path)
        return target.read_bytes()

    async def file_url(self, path: str) -> str:
        return str(self._resolve_file_path(path))
