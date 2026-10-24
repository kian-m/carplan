"""EPA fuel economy data (fueleconomy.gov) — free, no API key.
Docs: https://www.fueleconomy.gov/feg/ws/

Model names are EPA's, which are more specific than NHTSA's ("RAV4 Hybrid AWD" vs "RAV4"),
so `lookup` fuzzy-matches a plain model name to the closest EPA variant.
"""

from typing import Any

import httpx

BASE = "https://www.fueleconomy.gov/ws/rest"

# EPA field → our name. fuel_cost_annual assumes 15k miles/yr at current national fuel prices.
FIELDS = {
    "id": "id",
    "year": "year",
    "make": "make",
    "model": "model",
    "baseModel": "base_model",
    "VClass": "vehicle_class",
    "drive": "drive",
    "trany": "transmission",
    "atvType": "powertrain",  # Hybrid, Plug-in Hybrid, EV, Diesel, or blank for gas
    "fuelType": "fuel_type",
    "city08": "mpg_city",
    "highway08": "mpg_highway",
    "comb08": "mpg_combined",
    "fuelCost08": "fuel_cost_annual",
    "youSaveSpend": "five_year_savings_vs_average",  # negative = spends more than average car
    "co2TailpipeGpm": "co2_grams_per_mile",
    "range": "ev_range_miles",
}


NUMERIC = {"year", "mpg_city", "mpg_highway", "mpg_combined", "fuel_cost_annual",
           "five_year_savings_vs_average", "co2_grams_per_mile", "ev_range_miles"}


def _num(v: Any) -> int | float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return int(f) if f.is_integer() else f


def configured() -> bool:
    return True


async def _get(path: str, **params: Any) -> Any:
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(f"{BASE}{path}", params=params, headers={"Accept": "application/json"})
        r.raise_for_status()
        return r.json() if r.content else None


def _menu(data: Any) -> list[dict]:
    # A one-item menu comes back as an object instead of a list.
    items = (data or {}).get("menuItem") or []
    return items if isinstance(items, list) else [items]


async def models(year: int, make: str) -> list[str]:
    return [m["value"] for m in _menu(await _get("/vehicle/menu/model", year=year, make=make))]


async def options(year: int, make: str, model: str) -> list[dict]:
    """Engine/transmission variants for an exact EPA model name: [{id, label}]."""
    data = await _get("/vehicle/menu/options", year=year, make=make, model=model)
    return [{"id": o["value"], "label": o["text"]} for o in _menu(data)]


async def vehicle(vehicle_id: str) -> dict:
    data = await _get(f"/vehicle/{vehicle_id}")
    out = {name: data.get(src) for src, name in FIELDS.items()}
    return {k: _num(v) if k in NUMERIC else (v or None) for k, v in out.items()}


async def lookup(year: int, make: str, model: str) -> dict | None:
    """Best EPA match for a plain year/make/model, plus the other variants to choose from."""
    all_models = await models(year, make)
    wanted = model.lower()
    exact = [m for m in all_models if m.lower() == wanted]
    # Prefer the shortest name containing the query: "RAV4" → "RAV4 AWD" before "RAV4 Hybrid AWD".
    partial = sorted((m for m in all_models if wanted in m.lower()), key=len)
    candidates = exact or partial
    if not candidates:
        return None
    variants = await options(year, make, candidates[0])
    if not variants:
        return None
    return {**await vehicle(variants[0]["id"]), "other_models": candidates[1:], "variants": variants}
