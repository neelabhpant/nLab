"""Storage backend abstract base. v1 = SQLite + filesystem. v2 = Postgres + S3."""

from abc import ABC, abstractmethod
from typing import Optional


class StorageBackend(ABC):
    """Abstract storage backend. v1 = SQLite + filesystem. v2 = Postgres + S3."""

    @abstractmethod
    async def get(self, table: str, key: str) -> Optional[dict]:
        ...

    @abstractmethod
    async def put(self, table: str, key: str, value: dict) -> None:
        ...

    @abstractmethod
    async def delete(self, table: str, key: str) -> None:
        ...

    @abstractmethod
    async def list(self, table: str, prefix: Optional[str] = None) -> list[dict]:
        ...

    @abstractmethod
    async def store_file(self, path: str, data: bytes) -> str:
        """Returns the resolved location (filesystem path in v1, S3 URL in v2)."""
        ...

    @abstractmethod
    async def get_file(self, path: str) -> bytes:
        ...

    @abstractmethod
    async def file_url(self, path: str) -> str:
        """Returns a reference to the file (local path in v1, signed URL in v2)."""
        ...
