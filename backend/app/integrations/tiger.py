"""Tiger Data (TimescaleDB on Postgres). Docs: https://docs.tigerdata.com

A generic `events` hypertable (time, entity_id, metric, value) plus a daily
continuous aggregate covers most hackathon needs: sensor readings, prices,
balances, scores — anything you'd chart over time.
"""

from datetime import datetime
from typing import Any

import psycopg
from psycopg.rows import dict_row

from app.config import get_settings
from app.integrations import NotConfigured

SCHEMA = [
    """
    CREATE TABLE IF NOT EXISTS events (
        time      TIMESTAMPTZ      NOT NULL,
        entity_id TEXT             NOT NULL,
        metric    TEXT             NOT NULL,
        value     DOUBLE PRECISION NOT NULL,
        meta      JSONB
    )
    """,
    "SELECT create_hypertable('events', by_range('time'), if_not_exists => TRUE)",
    "CREATE INDEX IF NOT EXISTS events_entity_metric_time ON events (entity_id, metric, time DESC)",
    """
    CREATE MATERIALIZED VIEW IF NOT EXISTS events_daily
    WITH (timescaledb.continuous) AS
    SELECT time_bucket('1 day', time) AS bucket, entity_id, metric,
           avg(value) AS avg, min(value) AS min, max(value) AS max, count(*) AS n
    FROM events
    GROUP BY bucket, entity_id, metric
    WITH NO DATA
    """,
    """
    SELECT add_continuous_aggregate_policy('events_daily',
        start_offset => INTERVAL '3 years', end_offset => NULL,
        schedule_interval => INTERVAL '5 minutes', if_not_exists => TRUE)
    """,
]


def configured() -> bool:
    return bool(get_settings().tiger_database_url)


async def connect() -> psycopg.AsyncConnection:
    url = get_settings().tiger_database_url
    if not url:
        raise NotConfigured("Tiger Data", "TIGER_DATABASE_URL")
    return await psycopg.AsyncConnection.connect(url, autocommit=True, row_factory=dict_row)


async def init_schema() -> None:
    async with await connect() as conn:
        for stmt in SCHEMA:
            await conn.execute(stmt)


async def query(sql: str, params: tuple | dict | None = None) -> list[dict[str, Any]]:
    async with await connect() as conn:
        cur = await conn.execute(sql, params)
        return await cur.fetchall() if cur.description else []


async def insert_events(rows: list[tuple[datetime, str, str, float]]) -> int:
    """rows: (time, entity_id, metric, value)"""
    async with await connect() as conn:
        async with conn.cursor() as cur:
            await cur.executemany(
                "INSERT INTO events (time, entity_id, metric, value) VALUES (%s, %s, %s, %s)", rows
            )
    return len(rows)


async def series(entity_id: str, metric: str, bucket: str = "1 day", limit: int = 365) -> list[dict]:
    """Bucketed series straight from the raw table (works before the aggregate refreshes)."""
    return await query(
        """
        SELECT time_bucket(%s::interval, time) AS bucket, avg(value) AS value
        FROM events WHERE entity_id = %s AND metric = %s
        GROUP BY bucket ORDER BY bucket DESC LIMIT %s
        """,
        (bucket, entity_id, metric, limit),
    )
