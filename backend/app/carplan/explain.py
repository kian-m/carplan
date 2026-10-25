"""Turns a computed Plan into plain language. Gemini writes the words; every number it may
use is passed in. If Gemini is slow or unavailable, a template answer is returned instead.
"""

import hashlib
import json

from app.carplan.models import Plan, PlanInput
from app.integrations import gemini

SYSTEM = (
    "You are CarPlan, a Toyota Financial Services assistant. Explain the recommendation in plain, "
    "friendly language a first-time car buyer understands. Use ONLY the numbers provided, exactly as given "
    "(they are already whole dollars and match what the driver sees on screen); never round, invent "
    "prices, rates or savings. Write dollars with commas, like $21,420. Skip differences under $20; "
    "they don't matter to the driver. No jargon: say 'what you owe' instead of "
    "'payoff', 'what it's worth' instead of 'market value'. Be honest when another option is close. "
    "Write at a 6th-grade reading level: short sentences (under 15 words), everyday words. "
    "Write every field in sentence case (capitalize only the first word and proper nouns). "
    "The driver's car is already named above the headline, so the headline must not repeat its year, make "
    "or model (say 'Keep your car', not 'Keep your 2024 Toyota Corolla Hybrid'). "
    "When path is 'other', compare the recommendation with keeping their current car (current_car_option), "
    "not with the other Toyota options."
)

SCHEMA = {
    "type": "object",
    "properties": {
        "headline": {"type": "string", "description": "Under 10 words. The recommendation as an action."},
        "summary": {"type": "string", "description": "One sentence with the key saving or reason."},
        "reasons": {"type": "array", "items": {"type": "string"}, "minItems": 2, "maxItems": 3,
                    "description": "Short bullets, each grounded in a provided number."},
    },
    "required": ["headline", "summary", "reasons"],
}


_cache: dict[str, dict] = {}


def _whole(x):
    """Dollar amounts as whole numbers, so the words match the cards exactly."""
    if isinstance(x, float):
        return round(x) if abs(x) >= 10 else round(x, 2)
    if isinstance(x, dict):
        return {k: _whole(v) for k, v in x.items()}
    if isinstance(x, list):
        return [_whole(v) for v in x]
    return x


def _facts(inp: PlanInput, plan: Plan) -> dict:
    best = next(o for o in plan.options if o.id == plan.recommended)
    others = sorted((o for o in plan.options if o.id != best.id), key=lambda o: o.total_cost)
    current = next((o for o in plan.options if o.id in ("keep", "buy_out")), None)
    situation = plan.situation.model_dump(exclude={"market_value_sources"})
    if inp.contract.kind == "lease" and plan.situation.equity > 0:
        # With equity, switching cars means the dealer buys out the lease, so no mileage fee is ever
        # charged. Leave the fee out so the explanation can't present it as a reason to buy out.
        situation.pop("projected_excess_fee", None)
        situation.pop("projected_excess_miles", None)
        situation["mileage_fee_note"] = ("The car is worth more than the buyout, so switching cars avoids "
                                         "lease mileage fees too. Mileage fees are not a reason to pick any option.")
    return _whole({
        "driver": inp.name,
        "car": f"{inp.vehicle.year} {inp.vehicle.make} {inp.vehicle.model}",
        "path": inp.path,
        "contract": inp.contract.kind,
        "horizon_years": plan.horizon_months // 12,
        "miles_per_year": inp.miles_per_year,
        "situation": situation,
        "recommended": best.model_dump(),
        "runner_up": others[0].model_dump() if others else None,
        "savings_vs_runner_up": round(others[0].total_cost - best.total_cost) if others else 0,
        "current_car_option": current.model_dump() if current and current.id != best.id else None,
        "tfs_recommendations": [r.model_dump(include={"name", "reason"}) for r in plan.recommendations[:3]],
    })


def template(inp: PlanInput, plan: Plan) -> dict:
    f = _facts(inp, plan)
    best = f["recommended"]
    reasons = list(best["notes"][:2])
    if plan.recommendations:
        reasons.append(plan.recommendations[0].reason)
    saving = f["savings_vs_runner_up"]
    return {
        "headline": best["title"],
        "summary": f"It costs the least over {f['horizon_years']} years"
                   + (f", about ${saving:,} less than your next best choice." if saving > 0 else "."),
        "reasons": reasons[:3],
        "source": "template",
    }


async def explain(inp: PlanInput, plan: Plan) -> dict:
    facts = _facts(inp, plan)
    key = hashlib.sha1(json.dumps(facts, sort_keys=True, default=str).encode()).hexdigest()
    if key in _cache:
        return _cache[key]
    if not gemini.configured():
        return template(inp, plan)
    try:
        out = await gemini.hedged(lambda: gemini.generate_json(
            "Explain this CarPlan result:\n" + json.dumps(facts, default=str), SCHEMA, SYSTEM), hedges=(3, 7), timeout=12)
        out["source"] = "gemini"
    except Exception as e:
        print(f"explain: falling back to template ({type(e).__name__}: {e})")
        return template(inp, plan)
    _cache[key] = out
    return out
