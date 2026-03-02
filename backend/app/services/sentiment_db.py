"""SQLite persistence layer for daily sentiment snapshots."""

import logging
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "sentiment.db"


def _get_conn() -> sqlite3.Connection:
    """Get a connection to the sentiment database, creating it if needed."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute(
        """CREATE TABLE IF NOT EXISTS daily_sentiment (
            coin TEXT NOT NULL,
            date TEXT NOT NULL,
            score REAL NOT NULL,
            article_count INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (coin, date)
        )"""
    )
    conn.commit()
    return conn


def upsert_daily(coin: str, date: str, score: float, article_count: int) -> None:
    """Insert or update a daily sentiment snapshot."""
    conn = _get_conn()
    try:
        conn.execute(
            """INSERT INTO daily_sentiment (coin, date, score, article_count)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(coin, date) DO UPDATE SET
                 score = excluded.score,
                 article_count = excluded.article_count""",
            (coin, date, round(score, 3), article_count),
        )
        conn.commit()
    finally:
        conn.close()


def upsert_many(rows: list[tuple[str, str, float, int]]) -> None:
    """Batch upsert multiple daily sentiment rows.

    Args:
        rows: List of (coin, date, score, article_count) tuples.
    """
    if not rows:
        return
    conn = _get_conn()
    try:
        conn.executemany(
            """INSERT INTO daily_sentiment (coin, date, score, article_count)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(coin, date) DO UPDATE SET
                 score = excluded.score,
                 article_count = excluded.article_count""",
            [(coin, date, round(score, 3), count) for coin, date, score, count in rows],
        )
        conn.commit()
    finally:
        conn.close()


def get_trend(coin: str, days: int = 30) -> list[dict]:
    """Get historical sentiment trend from the database.

    Args:
        coin: CoinGecko coin ID.
        days: Number of days of history to return.

    Returns:
        List of {date, score, article_count} sorted by date, with zero-fill for missing days.
    """
    conn = _get_conn()
    try:
        today = datetime.now(timezone.utc).date()
        start = today - timedelta(days=days - 1)

        cursor = conn.execute(
            """SELECT date, score, article_count
               FROM daily_sentiment
               WHERE coin = ? AND date >= ? AND date <= ?
               ORDER BY date""",
            (coin, start.strftime("%Y-%m-%d"), today.strftime("%Y-%m-%d")),
        )
        stored = {row[0]: {"score": row[1], "article_count": row[2]} for row in cursor}

        result = []
        for i in range(days):
            d = start + timedelta(days=i)
            date_str = d.strftime("%Y-%m-%d")
            entry = stored.get(date_str)
            result.append({
                "date": date_str,
                "score": entry["score"] if entry else 0.0,
                "article_count": entry["article_count"] if entry else 0,
            })
        return result
    finally:
        conn.close()


def has_data(coin: str) -> bool:
    """Check if we have any stored data for a coin."""
    conn = _get_conn()
    try:
        cursor = conn.execute(
            "SELECT 1 FROM daily_sentiment WHERE coin = ? LIMIT 1", (coin,)
        )
        return cursor.fetchone() is not None
    finally:
        conn.close()
