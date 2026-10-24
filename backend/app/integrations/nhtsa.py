"""NHTSA vehicle data — free, no API key.
vPIC (VIN decoding, makes/models): https://vpic.nhtsa.dot.gov/api/
Recalls / complaints:              https://www.nhtsa.gov/nhtsa-datasets-and-apis

There is no free license-plate lookup; plate→VIN data comes from state DMVs via paid vendors.
"""

from typing import Any

import httpx

VPIC = "https://vpic.nhtsa.dot.gov/api/vehicles"
NHTSA = "https://api.nhtsa.gov"

# The handful of vPIC fields worth showing; DecodeVinValues returns ~150.
VIN_FIELDS = {
    "ModelYear": "year",
    "Make": "make",
    "Model": "model",
    "Trim": "trim",
    "BodyClass": "body",
    "DriveType": "drive",
    "FuelTypePrimary": "fuel",
    "ElectrificationLevel": "electrification",
    "EngineCylinders": "cylinders",
    "DisplacementL": "displacement_l",
    "EngineHP": "horsepower",
    "TransmissionStyle": "transmission",
    "Doors": "doors",
    "PlantCountry": "plant_country",
}


def configured() -> bool:
    return True


async def _get(url: str, **params: Any) -> dict:
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(url, params={"format": "json", **params})
        r.raise_for_status()
        return r.json()


async def decode_vin(vin: str, model_year: int | None = None) -> dict:
    """Returns a compact summary plus `raw` (every non-empty vPIC field)."""
    params = {"modelyear": model_year} if model_year else {}
    data = await _get(f"{VPIC}/DecodeVinValues/{vin.strip().upper()}", **params)
    row = data["Results"][0]
    summary = {out: row[src] for src, out in VIN_FIELDS.items() if row.get(src)}
    # vPIC returns ErrorCode "0" when the VIN decoded cleanly; anything else is a warning or error.
    valid = row.get("ErrorCode", "").split(",")[0].strip() == "0"
    return {
        "vin": vin.strip().upper(),
        **summary,
        "valid": valid,
        "error": None if valid else row.get("ErrorText"),
        "raw": {k: v for k, v in row.items() if v},
    }


async def models_for_make_year(make: str, year: int) -> list[str]:
    data = await _get(f"{VPIC}/GetModelsForMakeYear/make/{make}/modelyear/{year}")
    return sorted({r["Model_Name"] for r in data["Results"]})


async def recalls(make: str, model: str, year: int) -> list[dict]:
    data = await _get(f"{NHTSA}/recalls/recallsByVehicle", make=make, model=model, modelYear=year)
    return data.get("results", [])


async def complaints(make: str, model: str, year: int) -> list[dict]:
    data = await _get(f"{NHTSA}/complaints/complaintsByVehicle", make=make, model=model, modelYear=year)
    return data.get("results", [])
