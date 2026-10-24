"""CarPlan decision engine: deterministic math, no AI.

Every option is costed over the same horizon so they're comparable:
    total cost = payments + fuel + maintenance + insurance + exit fees
                 - equity applied at the start - equity you own at the end
Gemini only explains these numbers; it never produces them.
"""

from datetime import date

from app.carplan.models import CostBreakdown, Option, Plan, PlanInput, Recommendation, Situation
from app.carplan.tfs import PRODUCTS, PROTECTION_DISCLOSURE

# Shown to the user under "How we calculated this". Rates are illustrative, not offers.
ASSUMPTIONS = {
    "new_apr": 5.49,
    "certified_used_apr": 6.49,
    "buyout_apr": 6.49,
    "finance_term_months": 60,
    "buyout_term_months": 48,
    "new_lease_term_months": 36,
    "new_lease_residual_pct": 0.60,
    "new_lease_money_factor": 0.0021,
    "new_lease_miles_per_year": 12000,
    "certified_used_price_pct_of_msrp": 0.87,
    "certified_used_age_years": 2,
    "insurance_monthly": 165,
    "new_car_insurance_multiplier": 1.08,
    # Annual resale-value loss by brand (industry averages; Honda and Subaru hold value nearly as well as Toyota).
    "depreciation_per_year": {"toyota": 0.10, "lexus": 0.10, "honda": 0.11, "subaru": 0.115, "mazda": 0.12,
                              "hyundai": 0.13, "kia": 0.13, "ford": 0.14, "chevrolet": 0.14, "nissan": 0.14,
                              "default": 0.13},
    "sales_tax_rate": 0.0625,  # Texas motor vehicle sales tax, applied whenever you buy or lease a car
    "dealer_fees": 225,
    "new_car_first_year_depreciation": 0.15,
    "maintenance_per_year": {"0-2": 450, "3-5": 750, "6+": 1100},
    "non_toyota_maintenance_multiplier": 1.2,
    "toyotacare": "2 years / 25,000 miles of no-cost scheduled maintenance on new Toyotas",
    "flexible_monthly": 549,
    "flexible_per_mile": 0.20,
    "flexible_includes": "insurance and maintenance",
    "purchase_option_fee": 300,
    "disposition_fee": 350,
    "disposition_fee_waived_if_staying_with_toyota": True,
    "max_car_budget_pct_of_income": 0.20,
    "basic_warranty": {"months": 36, "miles": 36000},
    "fuel": "EPA annual fuel cost (fueleconomy.gov), scaled to your miles per year",
    "rates_disclaimer": "Example rates for comparison only. Actual rates and terms depend on credit approval through TFS.",
}

# Approximate starting MSRPs for current Toyota models.
TOYOTA_MSRP = {
    "Corolla": 23500, "Corolla Hybrid": 25000, "Corolla Cross Hybrid": 30000, "Prius": 29000,
    "Camry": 29500, "RAV4": 30500, "RAV4 Hybrid": 33000, "Highlander Hybrid": 46000,
    "Grand Highlander Hybrid": 48000, "Sienna": 40500, "Tacoma": 33500, "Tundra": 42000,
    "4Runner": 42000, "bZ4X": 38000,
}

# For current Toyota drivers: the next model we'd suggest (hybrid where one exists).
TOYOTA_UPGRADE = {
    "corolla": "Corolla Hybrid", "corolla cross": "Corolla Cross Hybrid", "rav4": "RAV4 Hybrid",
    "camry": "Camry", "highlander": "Highlander Hybrid", "grand highlander": "Grand Highlander Hybrid",
    "prius": "Prius", "sienna": "Sienna", "tacoma": "Tacoma", "tundra": "Tundra", "4runner": "4Runner",
    "bz4x": "bZ4X",
}

# For other makes: the closest Toyota by segment.
TOYOTA_EQUIVALENT = {
    "cr-v": "RAV4 Hybrid", "rogue": "RAV4 Hybrid", "cx-5": "RAV4 Hybrid", "tucson": "RAV4 Hybrid",
    "equinox": "RAV4 Hybrid", "escape": "RAV4 Hybrid", "forester": "RAV4 Hybrid", "sportage": "RAV4 Hybrid",
    "civic": "Corolla Hybrid", "elantra": "Corolla Hybrid", "sentra": "Corolla Hybrid", "mazda3": "Corolla Hybrid",
    "jetta": "Corolla Hybrid", "accord": "Camry", "altima": "Camry", "sonata": "Camry", "malibu": "Camry",
    "k5": "Camry", "pilot": "Highlander Hybrid", "explorer": "Highlander Hybrid",
    "telluride": "Grand Highlander Hybrid", "palisade": "Grand Highlander Hybrid", "odyssey": "Sienna",
    "pacifica": "Sienna", "carnival": "Sienna", "f-150": "Tundra", "f150": "Tundra", "silverado": "Tundra",
    "ram": "Tundra", "colorado": "Tacoma", "ranger": "Tacoma", "frontier": "Tacoma", "wrangler": "4Runner",
    "bronco": "4Runner", "model 3": "Prius", "model y": "bZ4X", "ioniq 5": "bZ4X", "mach-e": "bZ4X",
}


def toyota_target(inp: PlanInput) -> str:
    model = inp.vehicle.model.lower()
    table = TOYOTA_UPGRADE if inp.path == "toyota" else TOYOTA_EQUIVALENT
    # Longest key first so "corolla cross" wins over "corolla".
    for key in sorted(table, key=len, reverse=True):
        if key in model:
            return table[key]
    return inp.vehicle.model if inp.path == "toyota" and inp.vehicle.model in TOYOTA_MSRP else "RAV4 Hybrid"


# --- finance helpers ------------------------------------------------------

def payment(principal: float, apr: float, months: int) -> float:
    if principal <= 0 or months <= 0:
        return 0.0
    r = apr / 100 / 12
    return principal / months if r == 0 else principal * r / (1 - (1 + r) ** -months)


def balance_after(principal: float, apr: float, months: int, paid: int) -> float:
    if principal <= 0 or paid >= months:
        return 0.0
    r = apr / 100 / 12
    if r == 0:
        return principal * (1 - paid / months)
    pmt = payment(principal, apr, months)
    return principal * (1 + r) ** paid - pmt * ((1 + r) ** paid - 1) / r


def lease_payment(cap_cost: float, residual: float, money_factor: float, months: int) -> float:
    return max(0.0, (cap_cost - residual) / months + (cap_cost + residual) * money_factor)


def depreciate(value: float, years: float, make: str, miles_per_year: int) -> float:
    table = ASSUMPTIONS["depreciation_per_year"]
    rate = table.get(make.lower(), table["default"])
    rate += max(0, miles_per_year - 12000) / 3000 * 0.01  # high mileage loses value faster
    return value * (1 - rate) ** years


def maintenance(age_years: float, years: float, is_toyota: bool, new_toyota: bool) -> float:
    total, t = 0.0, 0.0
    tiers = ASSUMPTIONS["maintenance_per_year"]
    while t < years - 1e-9:
        step = min(1.0, years - t)
        age = age_years + t
        if new_toyota and age < 2:
            cost = 0  # ToyotaCare
        else:
            cost = tiers["0-2"] if age < 3 else tiers["3-5"] if age < 6 else tiers["6+"]
            if not is_toyota:
                cost *= ASSUMPTIONS["non_toyota_maintenance_multiplier"]
        total += cost * step
        t += step
    return total


def fuel(annual_cost_at_15k: float, miles_per_year: int, months: int) -> float:
    return annual_cost_at_15k * (miles_per_year / 15000) * months / 12


# --- plan -----------------------------------------------------------------

def build_plan(
    inp: PlanInput,
    market_value: float,
    market_low: float,
    market_high: float,
    market_method: str,
    market_sources: list[dict],
    fuel_current: float,
    fuel_target: float,
) -> Plan:
    A = ASSUMPTIONS
    v, c, f = inp.vehicle, inp.contract, inp.finances
    mpy = inp.miles_per_year
    is_toyota = v.make.lower() == "toyota"
    H = 36 if inp.path == "toyota" else 60
    years = H / 12
    target = toyota_target(inp)
    target_msrp = TOYOTA_MSRP.get(target, 33000)
    ins = A["insurance_monthly"]
    age_now = max(0.0, date.today().year - v.year + 0.5)
    budget = A["max_car_budget_pct_of_income"] * f.monthly_income
    disposable = f.monthly_income - f.monthly_bills

    # --- where the customer stands today, and at the decision point -------
    months_left = max(0, c.term_months - c.months_elapsed) if c.kind != "owned" else 0
    excess_miles, excess_fee, odo_end = 0, 0.0, None
    if c.kind == "lease":
        # A lease decision happens at lease end: value the car then.
        odo_end = int(v.odometer + mpy * months_left / 12)
        allowed = (c.miles_allowed_per_year or 12000) * c.term_months / 12
        excess_miles = max(0, int(odo_end - allowed))
        excess_fee = excess_miles * c.excess_mile_fee
        value_at_decision = depreciate(market_value, months_left / 12, v.make, mpy)
        payoff = (c.residual_value or 0) + A["purchase_option_fee"]
        age_at_decision = age_now + months_left / 12
        odo_at_decision = odo_end
    elif c.kind == "loan":
        value_at_decision = market_value
        payoff = balance_after(c.amount_financed or 0, c.apr or 0, c.term_months, c.months_elapsed)
        age_at_decision = age_now
        odo_at_decision = v.odometer
    else:
        value_at_decision, payoff, age_at_decision, odo_at_decision = market_value, 0.0, age_now, v.odometer
    equity = value_at_decision - payoff

    warranty_left = None
    if is_toyota:
        by_time = A["basic_warranty"]["months"] - age_now * 12
        by_miles = (A["basic_warranty"]["miles"] - v.odometer) / max(mpy, 1) * 12
        warranty_left = max(0, int(min(by_time, by_miles)))

    # Leaving the current car: positive equity is credited (dealer buys it out);
    # otherwise return it and pay excess-mileage charges. Disposition fee is waived
    # when staying with Toyota.
    def exit_terms(staying_with_toyota: bool) -> tuple[float, float, list[str]]:
        notes: list[str] = []
        if c.kind == "lease":
            if equity > 0:
                notes.append(f"Your lease has about ${equity:,.0f} in equity, applied to your next step")
                return 0.0, equity, notes
            fee = excess_fee + (0 if staying_with_toyota else A["disposition_fee"])
            if excess_fee:
                notes.append(f"Returning it: about {excess_miles:,} miles over your allowance (${excess_fee:,.0f})")
            return fee, 0.0, notes
        if c.kind == "loan":
            if equity < 0:
                notes.append(f"You owe ${-equity:,.0f} more than the car is worth; that gets rolled into the new loan")
            return 0.0, equity, notes  # negative equity_credit adds cost
        return 0.0, equity, notes

    def option(id_, title, label, monthly, b: CostBreakdown, notes, products, ltv=None):
        total = b.payments + b.fuel + b.maintenance + b.insurance + b.fees - b.equity_credit - b.equity_at_end
        car_monthly = monthly + (0 if id_ == "go_flexible" else ins)
        affordable = car_monthly <= budget and car_monthly <= disposable * 0.6
        return Option(
            id=id_, title=title, vehicle_label=label, monthly_payment=round(monthly, 2),
            true_monthly_cost=round(total / H, 2), total_cost=round(total, 2),
            breakdown=CostBreakdown(**{k: round(x, 2) for k, x in b.model_dump().items()}),
            affordable=affordable, notes=notes, tfs_products=products,
            loan_to_value=round(ltv, 3) if ltv is not None else None,
        )

    current_label = f"{v.year} {v.make.title()} {v.model}"
    options: list[Option] = []

    # 1. Keep the current car (buy out a lease, or keep paying a loan)
    if c.kind == "lease":
        financed = payoff * (1 + A["sales_tax_rate"]) + A["dealer_fees"]
        pm = payment(financed, A["buyout_apr"], A["buyout_term_months"])
        bal_end = balance_after(financed, A["buyout_apr"], A["buyout_term_months"], H)
        value_end = depreciate(value_at_decision, years, v.make, mpy)
        options.append(option(
            "buy_out", "Buy out your lease", current_label, pm,
            CostBreakdown(
                payments=pm * min(H, A["buyout_term_months"]), fuel=fuel(fuel_current, mpy, H),
                maintenance=maintenance(age_at_decision, years, is_toyota, False), insurance=ins * H,
                equity_at_end=value_end - bal_end,
            ),
            [f"Buyout price ${payoff:,.0f} vs. market value ${value_at_decision:,.0f}",
             "No mileage limits or lease-end charges",
             f"Includes ${financed - payoff:,.0f} sales tax and fees"],
            ["payoff_quote"], payoff / max(value_at_decision, 1),
        ))
    else:
        pm = c.monthly_payment if c.kind == "loan" else 0.0
        paid_months = min(H, months_left)
        bal_end = balance_after(c.amount_financed or 0, c.apr or 0, c.term_months, c.months_elapsed + H) if c.kind == "loan" else 0
        value_end = depreciate(value_at_decision, years, v.make, mpy)
        options.append(option(
            "keep", "Keep your car", current_label, pm,
            CostBreakdown(
                payments=pm * paid_months, fuel=fuel(fuel_current, mpy, H),
                maintenance=maintenance(age_at_decision, years, is_toyota, False), insurance=ins * H,
                equity_at_end=value_end - bal_end,
            ),
            [f"{months_left} payments left" if c.kind == "loan" else "Paid off"],
            [], payoff / max(value_at_decision, 1) if c.kind == "loan" else None,
        ))

    # 2. A new Toyota: lease for current Toyota lessees, finance otherwise
    fees, credit, exit_notes = exit_terms(True)
    new_ins = ins * A["new_car_insurance_multiplier"]
    if inp.path == "toyota" and c.kind == "lease":
        term = A["new_lease_term_months"]
        cap = target_msrp * (1 + A["sales_tax_rate"]) + A["dealer_fees"] - credit
        residual = target_msrp * A["new_lease_residual_pct"]
        pm = lease_payment(cap, residual, A["new_lease_money_factor"], term)
        options.append(option(
            "new_toyota", f"Lease a new {target}", f"New {target}", pm,
            CostBreakdown(
                payments=pm * H, fuel=fuel(fuel_target, mpy, H), maintenance=maintenance(0, years, True, True),
                insurance=new_ins * H, fees=fees, equity_credit=0,
            ),
            exit_notes + ["ToyotaCare: 2 years / 25,000 miles of scheduled maintenance included"],
            ["turn_in_new", "repeat_customer"],
        ))
    else:
        principal = target_msrp * (1 + A["sales_tax_rate"]) + A["dealer_fees"] - credit
        pm = payment(principal, A["new_apr"], A["finance_term_months"])
        bal_end = balance_after(principal, A["new_apr"], A["finance_term_months"], H)
        value_end = target_msrp * (1 - A["new_car_first_year_depreciation"]) * (1 - A["depreciation_per_year"]["toyota"]) ** (years - 1)
        options.append(option(
            "new_toyota", f"Get a new {target}", f"New {target}", pm,
            CostBreakdown(
                payments=pm * min(H, A["finance_term_months"]), fuel=fuel(fuel_target, mpy, H),
                maintenance=maintenance(0, years, True, True), insurance=new_ins * H, fees=fees,
                equity_at_end=value_end - bal_end,
            ),
            exit_notes + ["ToyotaCare: 2 years / 25,000 miles of scheduled maintenance included"],
            ["finance_new"] + (["repeat_customer"] if c.lender == "TFS" else ["prequalify"]),
            principal / target_msrp,
        ))

    # 3. Toyota Certified Used
    cpo_price = target_msrp * A["certified_used_price_pct_of_msrp"]
    principal = cpo_price * (1 + A["sales_tax_rate"]) + A["dealer_fees"] - credit
    pm = payment(principal, A["certified_used_apr"], A["finance_term_months"])
    bal_end = balance_after(principal, A["certified_used_apr"], A["finance_term_months"], H)
    value_end = depreciate(cpo_price, years, "toyota", mpy)
    options.append(option(
        "certified_used", f"Certified Used {target}", f"{date.today().year - A['certified_used_age_years']} {target}", pm,
        CostBreakdown(
            payments=pm * min(H, A["finance_term_months"]), fuel=fuel(fuel_target, mpy, H),
            maintenance=maintenance(A["certified_used_age_years"], years, True, False), insurance=ins * H,
            fees=fees, equity_at_end=value_end - bal_end,
        ),
        exit_notes + ["160-point inspection, Toyota Certified warranty, 1 year of Roadside Assistance"],
        ["certified_used"], principal / cpo_price,
    ))

    # 4. Go flexible: a Toyota subscription concept (Toyota's mobility direction)
    fees_flex, credit_flex, flex_notes = exit_terms(True)
    pm = A["flexible_monthly"] + A["flexible_per_mile"] * mpy / 12
    options.append(option(
        "go_flexible", "Go flexible", f"Toyota subscription · {target}", pm,
        CostBreakdown(
            payments=pm * H, fuel=fuel(fuel_target, mpy, H), fees=fees_flex,
            equity_credit=credit_flex,
        ),
        flex_notes + ["Insurance and maintenance included; swap or pause anytime (concept)"],
        [],
    ))

    # --- pick the cheapest affordable option -------------------------------
    pool = [o for o in options if o.affordable] or options
    best = min(pool, key=lambda o: o.total_cost)

    # --- TFS products that fit this situation ------------------------------
    recs: list[Recommendation] = []

    def rec(key, reason, priority):
        p = PRODUCTS[key]
        recs.append(Recommendation(product=key, name=p["name"], category=p["category"], reason=reason, url=p["url"], priority=priority))

    # GAP: underwater today, or the recommended loan starts underwater
    if c.kind in ("loan", "lease") and equity < 0 and best.id in ("keep", "buy_out"):
        rec("gap", f"You owe about ${-equity:,.0f} more than your {v.model} is worth. If it's totaled or stolen, insurance "
                   f"pays market value, and GAP can cover the ${-equity:,.0f} difference.", "high")
    elif best.loan_to_value and best.loan_to_value > 1.0:
        rec("gap", f"Your new loan would start at {best.loan_to_value:.0%} of the car's value. GAP covers the difference "
                   "if the car is totaled before you catch up.", "high")
    # VSA: keeping a car that leaves the basic warranty during the plan
    if best.id in ("buy_out", "keep") and is_toyota and warranty_left is not None and warranty_left < H:
        when = "has already ended" if warranty_left == 0 else f"ends in about {warranty_left} months"
        rec("vsa", f"Your basic warranty {when}. A Vehicle Service Agreement helps cover repair costs after that.", "medium")
    # Prepaid maintenance
    if best.id in ("buy_out", "keep") and is_toyota and (age_now >= 2 or v.odometer >= 25000):
        rec("auto_care", "Your ToyotaCare coverage has ended. Prepaid maintenance locks in today's prices for scheduled service.", "medium")
    elif best.id == "new_toyota":
        rec("toyotacare_plus", "Extend the included ToyotaCare with prepaid maintenance and major services.", "low")
    # Tire & Wheel for heavy drivers
    if mpy >= 15000:
        rec("tire_wheel", f"At {mpy:,} miles a year, road-hazard damage to tires and wheels is more likely.", "medium")
    # Excess Wear & Use for new leases
    if best.id == "new_toyota" and c.kind == "lease" and inp.path == "toyota" and (excess_miles > 0 or mpy > 12000):
        rec("excess_wear", "You've driven past your allowance on this lease. Excess Wear & Use protection helps avoid "
                           "lease-end charges next time.", "medium")
    # Rebates and loyalty
    if best.id in ("new_toyota", "certified_used"):
        if c.lender == "TFS":
            rec("repeat_customer", "As a current TFS customer you may qualify for repeat customer benefits.", "medium")
        else:
            rec("prequalify", "See if you're prequalified with Toyota Financial Services in a few steps.", "medium")
        rec("insurance", "Compare a Toyota Insurance quote for your new vehicle.", "low")
    if "college" in inp.flags:
        rec("college_rebate", "As a recent grad you may qualify for the TFS College Rebate Program.", "medium")
    if "military" in inp.flags:
        rec("military_rebate", "You may qualify for the TFS Military Rebate.", "medium")

    order = {"high": 0, "medium": 1, "low": 2}
    recs.sort(key=lambda r: order[r.priority])

    return Plan(
        horizon_months=H,
        situation=Situation(
            market_value=round(market_value), market_value_low=round(market_low), market_value_high=round(market_high),
            market_value_method=market_method, market_value_sources=market_sources,
            payoff=round(payoff), equity=round(equity), months_remaining=months_left,
            projected_odometer_at_end=odo_end, projected_excess_miles=excess_miles,
            projected_excess_fee=round(excess_fee), warranty_basic_months_left=warranty_left,
        ),
        options=options,
        recommended=best.id,
        recommendations=recs,
        toyota_equivalent=target,
        assumptions=A,
        disclosure=PROTECTION_DISCLOSURE + " " + A["rates_disclaimer"],
    )
