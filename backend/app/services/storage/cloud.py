"""CloudStorageBackend stub. v2 will implement Postgres (tables) + S3 (files).

Reserved for the cloud migration described in NEWSLETTER_COMPOSER_SPEC.md §2.1.
Not wired up in v1. Importing this module is safe; instantiating CloudStorageBackend
raises NotImplementedError until the v2 build lands.
"""

from typing import Optional

from .base import StorageBackend


class CloudStorageBackend(StorageBackend):
    """Postgres + S3 backend. Implementation deferred to v2."""

    def __init__(self) -> None:
        raise NotImplementedError(
            "CloudStorageBackend will be implemented in v2 (Postgres + S3). "
            "See NEWSLETTER_COMPOSER_SPEC.md §2.1."
        )

    async def get(self, table: str, key: str) -> Optional[dict]:
        raise NotImplementedError

    async def put(self, table: str, key: str, value: dict) -> None:
        raise NotImplementedError

    async def delete(self, table: str, key: str) -> None:
        raise NotImplementedError

    async def list(self, table: str, prefix: Optional[str] = None) -> list[dict]:
        raise NotImplementedError

    async def store_file(self, path: str, data: bytes) -> str:
        raise NotImplementedError

    async def get_file(self, path: str) -> bytes:
        raise NotImplementedError

    async def file_url(self, path: str) -> str:
        raise NotImplementedError
