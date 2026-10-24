"""What is the customer's car worth? Real listings via SerpApi, with a labeled fallback."""

import re
import statistics
from datetime import date

from app.carplan.models import Vehicle
from app.integrations import serpapi

PRICE = re.compile(r"\$\s?(\d{1,3}(?:,\d{3})+|\d{4,6})")
_cache: dict[str, dict] = {}  # SerpApi searches are metered; reuse results per vehicle


def fallback(v: Vehicle) -> dict:
    """Depreciation from MSRP when listings aren't available."""
    msrp = v.msrp or 30000
    age = max(0, date.today().year - v.year)
    value = msrp * 0.85 * (0.92 ** max(0, age - 1)) - max(0, v.odometer - 12000 * age) * 0.08
    value = max(value, msrp * 0.2)
    return {"value": value, "low": value * 0.92, "high": value * 1.08, "method": "estimate", "sources": []}


async def estimate(v: Vehicle, place: str = "Austin TX", location: str = "Austin, Texas, United States") -> dict:
    key = f"{v.year}|{v.make}|{v.model}|{v.trim}|{place}".lower()
    if key in _cache:
        return _cache[key]

    base = fallback(v)
    if not serpapi.configured():
        return base

    # Include the state: "for sale Austin" alone matches retail sales pages, not car listings.
    query = f"used {v.year} {v.make} {v.model} {v.trim or ''} for sale {place}".replace("  ", " ")
    try:
        data = await serpapi.google(query, location=location, num=20)
    except Exception:
        return base

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
        result = base
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
    _cache[key] = result
    return result
