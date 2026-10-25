"""Turns a computed Plan into plain language. Gemini writes the words; every number it may
use is passed in. If Gemini is slow or unavailable, a template answer is returned instead.
"""

import asyncio
import hashlib
import json

from app.carplan.models import Plan, PlanInput
from app.integrations import gemini

SYSTEM = (
    "You are CarPlan, a Toyota Financial Services assistant. Explain the recommendation in plain, "
    "friendly language a first-time car buyer understands. Use ONLY the numbers provided; never invent "
    "prices, rates or savings. Round dollars to the nearest $10. No jargon: say 'what you owe' instead of "
    "'payoff', 'what it's worth' instead of 'market value'. Be honest when another option is close. "
    "Write every field in sentence case (capitalize only the first word and proper nouns)."
)

SCHEMA = {
    "type": "object",
    "properties": {
        "headline": {"type": "string", "description": "Under 10 words. The recommendation as an action."},
        "summary": {"type": "string", "description": "One sentence with the key saving or reason."},
        "reasons": {"type": "array", "items": {"type": "string"}, "minItems": 2, "maxItems": 3,
                    "description": "Short bullets, each grounded in a provided number."},
        "next_step": {"type": "string", "description": "Button label, 2-5 words, starts with a verb."},
    },
    "required": ["headline", "summary", "reasons", "next_step"],
}

NEXT_STEP = {
    "buy_out": "Request a payoff quote",
    "keep": "Keep driving",
    "new_toyota": "Find your next Toyota",
    "certified_used": "Browse Certified Used",
    "go_flexible": "Join the waitlist",
}

_cache: dict[str, dict] = {}


def _facts(inp: PlanInput, plan: Plan) -> dict:
    best = next(o for o in plan.options if o.id == plan.recommended)
    others = sorted((o for o in plan.options if o.id != best.id), key=lambda o: o.total_cost)
    return {
        "driver": inp.name,
        "car": f"{inp.vehicle.year} {inp.vehicle.make} {inp.vehicle.model}",
        "path": inp.path,
        "contract": inp.contract.kind,
        "horizon_years": plan.horizon_months // 12,
        "miles_per_year": inp.miles_per_year,
        "situation": plan.situation.model_dump(exclude={"market_value_sources"}),
        "recommended": best.model_dump(),
        "runner_up": others[0].model_dump() if others else None,
        "savings_vs_runner_up": round(others[0].total_cost - best.total_cost) if others else 0,
        "tfs_recommendations": [r.model_dump(include={"name", "reason"}) for r in plan.recommendations[:3]],
    }


def template(inp: PlanInput, plan: Plan) -> dict:
    f = _facts(inp, plan)
    best = f["recommended"]
    reasons = list(best["notes"][:2])
    if plan.recommendations:
        reasons.append(plan.recommendations[0].reason)
    saving = f["savings_vs_runner_up"]
    return {
        "headline": best["title"],
        "summary": f"It's the lowest total cost over {f['horizon_years']} years"
                   + (f", about ${saving:,} less than the next best option." if saving > 0 else "."),
        "reasons": reasons[:3],
        "next_step": NEXT_STEP[best["id"]],
        "source": "template",
    }


async def _hedged(call, hedges: tuple[float, ...] = (3, 7), timeout: float = 12):
    """Most Gemini calls finish in 2-4s but some stall for 15-25s. Start an identical backup call
    at each `hedges` mark while none has answered, and return the first success."""
    loop = asyncio.get_running_loop()
    deadline = loop.time() + timeout
    marks = [loop.time() + h for h in hedges]
    tasks = [asyncio.create_task(call())]
    error: BaseException | None = None
    try:
        while True:
            wake = min([*marks, deadline])
            pending = [t for t in tasks if not t.done()]
            if pending:
                done, _ = await asyncio.wait(pending, timeout=max(0, wake - loop.time()), return_when=asyncio.FIRST_COMPLETED)
                for t in done:
                    if t.exception() is None:
                        return t.result()
                    error = t.exception()
            elif not marks:
                raise error or TimeoutError("Gemini did not answer in time")
            if loop.time() >= deadline:
                raise TimeoutError("Gemini did not answer in time")
            if marks and (loop.time() >= marks[0] or not pending):
                marks.pop(0)
                tasks.append(asyncio.create_task(call()))
    finally:
        for t in tasks:
            t.cancel()


async def explain(inp: PlanInput, plan: Plan) -> dict:
    facts = _facts(inp, plan)
    key = hashlib.sha1(json.dumps(facts, sort_keys=True, default=str).encode()).hexdigest()
    if key in _cache:
        return _cache[key]
    if not gemini.configured():
        return template(inp, plan)
    try:
        out = await _hedged(lambda: gemini.generate_json(
            "Explain this CarPlan result:\n" + json.dumps(facts, default=str), SCHEMA, SYSTEM))
        out["source"] = "gemini"
    except Exception as e:
        print(f"explain: falling back to template ({type(e).__name__}: {e})")
        return template(inp, plan)
    _cache[key] = out
    return out
