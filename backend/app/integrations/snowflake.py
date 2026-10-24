"""Snowflake Cortex REST API (optional MLH track).
Docs: https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-llm-rest-api
"""

import httpx

from app.config import get_settings
from app.integrations import NotConfigured


def configured() -> bool:
    s = get_settings()
    return bool(s.snowflake_account_url and s.snowflake_pat)


async def complete(prompt: str, model: str | None = None) -> str:
    s = get_settings()
    if not configured():
        raise NotConfigured("Snowflake", "SNOWFLAKE_ACCOUNT_URL and SNOWFLAKE_PAT")
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"{s.snowflake_account_url.rstrip('/')}/api/v2/cortex/inference:complete",
            headers={
                "Authorization": f"Bearer {s.snowflake_pat}",
                "X-Snowflake-Authorization-Token-Type": "PROGRAMMATIC_ACCESS_TOKEN",
                "Accept": "application/json",
            },
            json={"model": model or s.snowflake_model, "messages": [{"content": prompt}], "stream": False},
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]
