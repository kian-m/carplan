"""CarPlan API: sample drivers, plans, contract reading, and recall alerts."""

import asyncio
from datetime import date

from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, EmailStr

from app.carplan import alerts, drivers, engine, explain, market
from app.carplan.models import PlanInput
from app.carplan.tfs import PRODUCTS
from app.integrations import fueleconomy, gemini, nhtsa

router = APIRouter(prefix="/api")

DEFAULT_FUEL = 1900  # EPA-average annual fuel cost at 15k miles, used if a lookup fails


_fuel_cache: dict[tuple, float] = {}


async def _fuel(year: int, make: str, model: str) -> float:
    key = (year, make.lower(), model.lower())
    if key not in _fuel_cache:
        try:
            v = await fueleconomy.lookup(year, make, model)
            _fuel_cache[key] = float(v["fuel_cost_annual"]) if v and v.get("fuel_cost_annual") else DEFAULT_FUEL
        except Exception:
            return DEFAULT_FUEL  # don't cache failures
    return _fuel_cache[key]


async def _plan(inp: PlanInput) -> dict:
    target = engine.toyota_target(inp)
    v = inp.vehicle
    est, fuel_now, fuel_target = await asyncio.gather(
        market.estimate(v),
        _fuel(v.year, v.make, v.model),
        _fuel(min(date.today().year, 2025), "Toyota", target),  # EPA data lags the newest model year
    )
    if inp.market_value is not None:
        value, low, high, method = inp.market_value, est["low"], est["high"], "user"
    else:
        value, low, high, method = est["value"], est["low"], est["high"], est["method"]
    plan = engine.build_plan(inp, value, low, high, method, est.get("sources", []), fuel_now, fuel_target)
    return {"input": inp.model_dump(), "plan": plan.model_dump(),
            "fuel": {"current_annual": fuel_now, "toyota_annual": fuel_target}}


# --- sample drivers -------------------------------------------------------

@router.get("/drivers")
async def list_drivers():
    return drivers.summaries()


@router.post("/drivers/seed")
async def seed_drivers():
    return await drivers.seed()


@router.get("/drivers/{key}")
async def get_driver(key: str):
    if key not in drivers.DRIVERS:
        raise HTTPException(404, f"Unknown driver: {key}")
    return (await drivers.load(key)).model_dump()


@router.get("/drivers/{key}/mileage")
async def driver_mileage(key: str):
    if key not in drivers.DRIVERS:
        raise HTTPException(404, f"Unknown driver: {key}")
    return await drivers.mileage_history(key)


# --- plans ----------------------------------------------------------------

@router.post("/plan")
async def plan(inp: PlanInput):
    """Fast and deterministic: call on every slider change."""
    return await _plan(inp)


@router.post("/plan/explain")
async def plan_explain(inp: PlanInput):
    """Plain-language explanation of the recommendation (Gemini, with a template fallback)."""
    result = await _plan(inp)
    p = engine.Plan.model_validate(result["plan"])
    return await explain.explain(inp, p)


@router.get("/tfs/products")
async def tfs_products():
    return PRODUCTS


# --- vehicle + contract intake --------------------------------------------

@router.get("/vehicle/value")
async def vehicle_value(year: int, make: str, model: str, odometer: int, trim: str | None = None):
    return await market.estimate(market.Vehicle(year=year, make=make, model=model, trim=trim, odometer=odometer))


CONTRACT_SCHEMA = {
    "type": "object",
    "properties": {
        "kind": {"type": "string", "enum": ["lease", "loan"]},
        "lender": {"type": "string"},
        "vin": {"type": "string"},
        "year": {"type": "integer"},
        "make": {"type": "string"},
        "model": {"type": "string"},
        "trim": {"type": "string"},
        "odometer_at_signing": {"type": "integer"},
        "msrp": {"type": "number"},
        "monthly_payment": {"type": "number", "description": "Base monthly payment before tax"},
        "term_months": {"type": "integer"},
        "first_payment_date": {"type": "string", "description": "YYYY-MM-DD"},
        "residual_value": {"type": "number", "description": "Lease only: purchase option price at lease end"},
        "miles_allowed_per_year": {"type": "integer", "description": "Lease only"},
        "excess_mile_fee": {"type": "number", "description": "Lease only: dollars per mile over the allowance"},
        "apr": {"type": "number", "description": "Loan only: annual percentage rate, e.g. 7.9"},
        "amount_financed": {"type": "number", "description": "Loan only"},
        "plain_language": {
            "type": "array",
            "description": "3-5 key terms from this contract, each explained in one plain sentence",
            "items": {"type": "object", "properties": {"term": {"type": "string"}, "meaning": {"type": "string"}},
                      "required": ["term", "meaning"]},
        },
    },
    "required": ["kind"],
}

CONTRACT_PROMPT = (
    "This is a vehicle lease or retail installment (loan) contract. Extract the fields in the schema. "
    "Leave out any field you can't find; never guess numbers. In plain_language, explain the terms a "
    "first-time driver would find confusing (like residual value, money factor, disposition fee)."
)


@router.post("/contract/parse")
async def parse_contract(file: UploadFile):
    data = await file.read()
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(413, "File too large: upload a PDF or photo under 15 MB")
    mime = file.content_type or "application/pdf"
    if not (mime == "application/pdf" or mime.startswith("image/")):
        raise HTTPException(415, "Upload a PDF or a photo of your contract")
    out = await gemini.extract_from_file(data, mime, CONTRACT_PROMPT, CONTRACT_SCHEMA)
    if out and out.get("vin") and not out.get("model"):
        try:
            decoded = await nhtsa.decode_vin(out["vin"])
            out.update({k: decoded[k] for k in ("year", "make", "model", "trim") if decoded.get(k)})
        except Exception:
            pass
    return out


# --- recall alerts --------------------------------------------------------

class SubscribeIn(BaseModel):
    email: EmailStr
    year: int
    make: str
    model: str
    vin: str | None = None


@router.post("/alerts/subscribe")
async def alerts_subscribe(body: SubscribeIn):
    return await alerts.subscribe(body.email, body.year, body.make, body.model, body.vin)


@router.get("/alerts/unsubscribe", response_class=HTMLResponse)
async def alerts_unsubscribe(token: str):
    ok = await alerts.unsubscribe(token)
    msg = "You're unsubscribed from CarPlan recall alerts." if ok else "This link has already been used."
    return f"<div style=\"font-family:'Helvetica Neue',Arial;padding:48px;max-width:480px\"><h2>CarPlan</h2><p>{msg}</p></div>"


@router.post("/alerts/check")
async def alerts_check():
    return await alerts.check()


@router.get("/alerts/stats")
async def alerts_stats():
    return await alerts.stats()
