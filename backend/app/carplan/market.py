"""What is the customer's car worth? Real listings via SerpApi, with a labeled fallback."""

import json
import re
import statistics
import time
from datetime import date

from app.carplan.models import Vehicle
from app.integrations import serpapi, tiger

PRICE = re.compile(r"\$\s?(\d{1,3}(?:,\d{3})+|\d{4,6})")
_cache: dict[str, tuple[float, dict]] = {}  # SerpApi searches are metered; reuse results per vehicle
RETRY_AFTER = 600  # seconds before retrying a search that found too few listings

# Search results vary from run to run. The last search that found real listings is saved, so a thin
# search later (or a new server) reuses real prices instead of dropping to the formula estimate.
SCHEMA = """
CREATE TABLE IF NOT EXISTS market_values (
    key        TEXT PRIMARY KEY,
    result     JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)
"""


async def _save(key: str, result: dict) -> None:
    if not tiger.configured():
        return
    try:
        await tiger.query(SCHEMA)
        await tiger.query(
            "INSERT INTO market_values (key, result) VALUES (%s, %s) "
            "ON CONFLICT (key) DO UPDATE SET result = EXCLUDED.result, updated_at = now()",
            (key, json.dumps(result)),
        )
    except Exception as e:
        print(f"market: could not save listings ({type(e).__name__})")


async def _last_good(key: str) -> dict | None:
    if not tiger.configured():
        return None
    try:
        await tiger.query(SCHEMA)
        rows = await tiger.query("SELECT result FROM market_values WHERE key = %s", (key,))
        return rows[0]["result"] if rows else None
    except Exception:
        return None


def fallback(v: Vehicle) -> dict:
    """Depreciation from MSRP when listings aren't available."""
    msrp = v.msrp or 30000
    age = max(0, date.today().year - v.year)
    value = msrp * 0.85 * (0.92 ** max(0, age - 1)) - max(0, v.odometer - 12000 * age) * 0.08
    value = max(value, msrp * 0.2)
    return {"value": value, "low": value * 0.92, "high": value * 1.08, "method": "estimate", "sources": []}


async def estimate(v: Vehicle, place: str = "Austin TX", location: str = "Austin, Texas, United States") -> dict:
    key = f"{v.year}|{v.make}|{v.model}|{v.trim}|{place}".lower()
    if key in _cache and (_cache[key][1]["method"] == "listings" or time.time() - _cache[key][0] < RETRY_AFTER):
        return _cache[key][1]

    base = fallback(v)
    if not serpapi.configured():
        return base

    # Include the state: "for sale Austin" alone matches retail sales pages, not car listings.
    query = f"used {v.year} {v.make} {v.model} {v.trim or ''} for sale {place}".replace("  ", " ")
    try:
        data = await serpapi.google(query, location=location, num=20, gl="us", hl="en")
    except Exception:
        data = {}

    prices: list[int] = []
    sources: list[dict] = []
    for r in data.get("organic_results", []):
        text = " ".join(str(x) for x in (r.get("title"), r.get("snippet"), r.get("rich_snippet")) if x)
        # Drop prices that can't be this car (accessories, monthly payments, other trims far off).
        found = [int(m.replace(",", "")) for m in PRICE.findall(text)]
        found = [p for p in found if base["value"] * 0.5 <= p <= base["value"] * 1.8]
        if found:
            prices += found
            sources.append({"title": r.get("source") or r.get("title"), "url": r.get("link")})

    if len(prices) < 3:
        result = await _last_good(key) or base
    else:
        prices.sort()
        q = statistics.quantiles(prices, n=4)
        result = {
            "value": statistics.median(prices),
            "low": q[0],
            "high": q[2],
            "method": "listings",
            "sources": sources[:6],
            "listing_count": len(prices),
        }
        await _save(key, result)
    _cache[key] = (time.time(), result)
    return result
