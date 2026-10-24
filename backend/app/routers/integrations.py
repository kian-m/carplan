"""Thin endpoints over each integration — for smoke-testing keys and as copy-paste starting points."""

from datetime import datetime, timedelta, timezone
import random

from fastapi import APIRouter
from pydantic import BaseModel

from app.integrations import fueleconomy, gemini, nessie, nhtsa, serpapi, snowflake, tiger

router = APIRouter(prefix="/api")


@router.get("/status")
async def status() -> dict[str, bool]:
    return {
        "nessie": nessie.configured(),
        "serpapi": serpapi.configured(),
        "gemini": gemini.configured(),
        "tiger": tiger.configured(),
        "snowflake": snowflake.configured(),
        "nhtsa": nhtsa.configured(),
        "fueleconomy": fueleconomy.configured(),
    }


# --- fueleconomy.gov (no key) ---------------------------------------------

@router.get("/fuel/lookup")
async def fuel_lookup(year: int, make: str, model: str):
    return await fueleconomy.lookup(year, make, model)


@router.get("/fuel/models")
async def fuel_models(year: int, make: str):
    return await fueleconomy.models(year, make)


@router.get("/fuel/options")
async def fuel_options(year: int, make: str, model: str):
    return await fueleconomy.options(year, make, model)


@router.get("/fuel/vehicle/{vehicle_id}")
async def fuel_vehicle(vehicle_id: str):
    return await fueleconomy.vehicle(vehicle_id)


# --- NHTSA (no key) -------------------------------------------------------

@router.get("/vehicle/vin/{vin}")
async def vehicle_vin(vin: str, model_year: int | None = None):
    return await nhtsa.decode_vin(vin, model_year)


@router.get("/vehicle/models")
async def vehicle_models(make: str, year: int):
    return await nhtsa.models_for_make_year(make, year)


@router.get("/vehicle/recalls")
async def vehicle_recalls(make: str, model: str, year: int):
    return await nhtsa.recalls(make, model, year)


@router.get("/vehicle/complaints")
async def vehicle_complaints(make: str, model: str, year: int):
    return await nhtsa.complaints(make, model, year)


# --- Nessie ---------------------------------------------------------------

@router.get("/nessie/customers")
async def nessie_customers():
    return await nessie.list_customers()


@router.get("/nessie/customers/{customer_id}/snapshot")
async def nessie_snapshot(customer_id: str):
    return await nessie.financial_snapshot(customer_id)


# --- SerpApi --------------------------------------------------------------

@router.get("/search")
async def search(q: str, engine: str = "google"):
    return await serpapi.search(engine, q=q)


# --- Gemini ---------------------------------------------------------------

class PromptIn(BaseModel):
    prompt: str
    system: str | None = None


class ChatIn(BaseModel):
    messages: list[dict[str, str]]  # [{"role": "user"|"model", "text": "..."}]
    system: str | None = None


@router.post("/ai/generate")
async def ai_generate(body: PromptIn):
    return {"text": await gemini.generate(body.prompt, body.system)}


@router.post("/ai/chat")
async def ai_chat(body: ChatIn):
    return {"text": await gemini.chat(body.messages, body.system)}


# --- Tiger Data -----------------------------------------------------------

@router.post("/tiger/init")
async def tiger_init():
    await tiger.init_schema()
    return {"ok": True}


@router.post("/tiger/seed-demo")
async def tiger_seed(entity_id: str = "demo", metric: str = "value", days: int = 90):
    now = datetime.now(timezone.utc)
    v = 100.0
    rows = []
    for i in range(days * 24):
        v += random.gauss(0, 1)
        rows.append((now - timedelta(hours=days * 24 - i), entity_id, metric, round(v, 2)))
    return {"inserted": await tiger.insert_events(rows)}


@router.get("/tiger/series")
async def tiger_series(entity_id: str = "demo", metric: str = "value", bucket: str = "1 day"):
    return await tiger.series(entity_id, metric, bucket)


# --- Snowflake (optional) -------------------------------------------------

@router.post("/snowflake/complete")
async def snowflake_complete(body: PromptIn):
    return {"text": await snowflake.complete(body.prompt)}
