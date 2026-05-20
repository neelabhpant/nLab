"""Storage abstraction. v1 = LocalStorageBackend. v2 will swap in CloudStorageBackend.

Feature code must depend on the StorageBackend interface (see base.py), not on the
concrete backend. See NEWSLETTER_COMPOSER_SPEC.md §2.1 and §3.
"""

from .base import StorageBackend
from .local import LocalStorageBackend

_backend: StorageBackend | None = None


def get_storage() -> StorageBackend:
    """Return the active storage backend. v1 always returns LocalStorageBackend."""
    global _backend
    if _backend is None:
        _backend = LocalStorageBackend()
    return _backend


__all__ = ["StorageBackend", "LocalStorageBackend", "get_storage"]
