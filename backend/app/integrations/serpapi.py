"""SerpApi — one function, any engine. Engines: https://serpapi.com/search-api

Useful engines: google, google_shopping, google_maps, google_local, google_flights,
google_hotels, google_news, google_finance, google_scholar, youtube.
"""

from typing import Any

import httpx

from app.config import get_settings
from app.integrations import NotConfigured


def configured() -> bool:
    return bool(get_settings().serpapi_api_key)


async def search(engine: str = "google", **params: Any) -> dict:
    s = get_settings()
    if not s.serpapi_api_key:
        raise NotConfigured("SerpApi", "SERPAPI_API_KEY")
    query = {"engine": engine, "api_key": s.serpapi_api_key, **params}
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get("https://serpapi.com/search.json", params=query)
        r.raise_for_status()
        return r.json()


async def google(q: str, **params: Any) -> dict:
    return await search("google", q=q, **params)


async def shopping(q: str, **params: Any) -> dict:
    return await search("google_shopping", q=q, **params)


async def maps(q: str, ll: str | None = None, **params: Any) -> dict:
    """ll like "@30.2849,-97.7341,14z" (UT Austin)."""
    if ll:
        params["ll"] = ll
    return await search("google_maps", q=q, type="search", **params)
