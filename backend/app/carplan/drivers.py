"""Sample drivers for the demo. Each is seeded into Nessie (bank) and Tiger Data (odometer
history), and their plan input is read back from those systems, with the static values
below as a fallback so the demo never breaks.
"""

import random
from datetime import date, datetime, timedelta, timezone

from app.carplan.models import Contract, Finances, PlanInput, Vehicle
from app.integrations import nessie, tiger

ADDRESS = {"street_number": "2100", "street_name": "Speedway", "city": "Austin", "state": "TX", "zip": "78712"}

DRIVERS: dict[str, dict] = {
    "maria": {
        "first": "Maria", "last": "Lopez",
        "tagline": "RAV4 lease ends in 3 months",
        "input": PlanInput(
            path="toyota", name="Maria",
            vehicle=Vehicle(vin="2T3P1RFV9NC104512", year=2022, make="Toyota", model="RAV4", trim="XLE",
                            odometer=41200, msrp=32000),
            contract=Contract(kind="lease", monthly_payment=389, term_months=36, months_elapsed=33,
                              residual_value=21120, miles_allowed_per_year=12000, excess_mile_fee=0.15, lender="TFS"),
            finances=Finances(monthly_income=6200, monthly_bills=2345, checking_balance=8400),
            miles_per_year=15000,
        ),
        "income": 6200, "checking": 8400,
        "bills": [("Riverside Apartments", 1750), ("Austin Energy", 180), ("Verizon", 85),
                  ("Google Fiber", 70), ("Nelnet Student Loan", 260), ("Toyota Financial Services", 389)],
    },
    "sam": {
        "first": "Sam", "last": "Patel",
        "tagline": "Corolla Hybrid loan, new baby on the way",
        "input": PlanInput(
            path="toyota", name="Sam",
            vehicle=Vehicle(vin="JTDBCMFE2RJ012345", year=2024, make="Toyota", model="Corolla Hybrid", trim="LE",
                            odometer=15200, msrp=25500),
            contract=Contract(kind="loan", monthly_payment=545, term_months=72, months_elapsed=10,
                              apr=7.9, amount_financed=31200, lender="TFS"),
            finances=Finances(monthly_income=5100, monthly_bills=2600, checking_balance=2300),
            miles_per_year=18000,
        ),
        "income": 5100, "checking": 2300,
        "bills": [("Eastside Lofts", 1450), ("Bright Horizons Daycare", 900), ("Austin Energy", 160),
                  ("T-Mobile", 90), ("Toyota Financial Services", 545)],
    },
    "jordan": {
        "first": "Jordan", "last": "Kim",
        "tagline": "Honda CR-V lease, recent grad",
        "input": PlanInput(
            path="other", name="Jordan", flags=["college"],
            vehicle=Vehicle(vin="7FARW2H58NE004117", year=2022, make="Honda", model="CR-V", trim="EX",
                            odometer=37500, msrp=31600),
            contract=Contract(kind="lease", monthly_payment=429, term_months=36, months_elapsed=30,
                              residual_value=19600, miles_allowed_per_year=12000, excess_mile_fee=0.15,
                              lender="American Honda Finance"),
            finances=Finances(monthly_income=5600, monthly_bills=2170, checking_balance=5200),
            miles_per_year=14000,
        ),
        "income": 5600, "checking": 5200,
        "bills": [("The Domain Apartments", 1600), ("Austin Energy", 140), ("AT&T", 75),
                  ("Life Time Fitness", 45), ("Mohela Student Loan", 310), ("American Honda Finance", 429)],
    },
}

CAR_LENDERS = ("toyota financial", "honda finance")
_nessie_ids: dict[str, str] = {}


def summaries() -> list[dict]:
    out = []
    for key, d in DRIVERS.items():
        v = d["input"].vehicle
        out.append({"id": key, "name": f"{d['first']} {d['last']}", "tagline": d["tagline"],
                    "path": d["input"].path, "vehicle": f"{v.year} {v.make} {v.model}"})
    return out


async def _find_customer(key: str) -> str | None:
    if key in _nessie_ids:
        return _nessie_ids[key]
    d = DRIVERS[key]
    for c in await nessie.list_customers():
        if c.get("first_name") == d["first"] and c.get("last_name") == d["last"]:
            _nessie_ids[key] = c["_id"]
            return c["_id"]
    return None


def _odometer_rows(key: str) -> list[tuple]:
    """A year of daily odometer readings ending at today's odometer."""
    d = DRIVERS[key]["input"]
    rng = random.Random(key)
    daily = d.miles_per_year / 365
    miles = [max(0.0, rng.gauss(daily * (1.15 if (i % 7) < 5 else 0.6), daily * 0.35)) for i in range(365)]
    scale = d.miles_per_year / sum(miles)
    now = datetime.now(timezone.utc).replace(hour=20, minute=0, second=0, microsecond=0)
    odo, rows = float(d.vehicle.odometer), []
    for i in range(365):
        rows.append((now - timedelta(days=i), f"driver:{key}", "odometer", round(odo)))
        odo -= miles[i] * scale
    return rows


async def seed() -> dict:
    """Idempotent: creates missing Nessie customers and rewrites odometer history."""
    report: dict = {}
    for key, d in DRIVERS.items():
        r: dict = {}
        if nessie.configured():
            # Fills in whatever is missing, so a partly-seeded customer gets repaired.
            cid = await _find_customer(key)
            if not cid:
                cid = (await nessie.create_customer(d["first"], d["last"], ADDRESS))["_id"]
                _nessie_ids[key] = cid
            accounts = await nessie.list_accounts(cid)
            acct = accounts[0] if accounts else await nessie.create_account(cid, "Everyday Checking", d["checking"])
            if not await nessie.list_bills(acct["_id"]):
                for i, (payee, amount) in enumerate(d["bills"]):
                    await nessie.create_bill(acct["_id"], payee, amount, recurring_day=1 + (i * 5) % 28)
            if not await nessie.list_deposits(acct["_id"]):
                today = date.today()
                for days_ago in (1, 15):
                    await nessie.create_deposit(acct["_id"], d["income"] / 2,
                                                (today - timedelta(days=days_ago)).isoformat(), "Payroll")
            r["nessie"] = cid
        if tiger.configured():
            await tiger.query("DELETE FROM events WHERE entity_id = %s AND metric = 'odometer'", (f"driver:{key}",))
            r["tiger_rows"] = await tiger.insert_events(_odometer_rows(key))
        report[key] = r
    return report


async def _finances_from_nessie(key: str) -> Finances | None:
    cid = await _find_customer(key)
    if not cid:
        return None
    snap = await nessie.financial_snapshot(cid)
    bills = income = balance = 0.0
    for acct in snap["accounts"]:
        balance += acct.get("balance", 0)
        for b in acct.get("bills", []):
            if not any(l in b.get("payee", "").lower() for l in CAR_LENDERS):
                bills += b.get("payment_amount", 0)
        income += sum(dep.get("amount", 0) for dep in acct.get("deposits", []) if dep.get("description") == "Payroll")
    if not income:
        return None
    return Finances(monthly_income=income, monthly_bills=bills, checking_balance=balance, source="nessie")


async def _miles_per_year_from_tiger(key: str) -> int | None:
    rows = await tiger.query(
        """SELECT max(value) - min(value) AS miles, extract(epoch FROM max(time) - min(time)) / 86400 AS days
           FROM events WHERE entity_id = %s AND metric = 'odometer' AND time > now() - interval '180 days'""",
        (f"driver:{key}",),
    )
    if not rows or not rows[0]["days"]:
        return None
    return int(round(rows[0]["miles"] / float(rows[0]["days"]) * 365, -2))


async def load(key: str) -> PlanInput:
    inp = DRIVERS[key]["input"].model_copy(deep=True)
    if nessie.configured():
        try:
            if fin := await _finances_from_nessie(key):
                inp.finances = fin
        except Exception:
            pass
    if tiger.configured():
        try:
            if mpy := await _miles_per_year_from_tiger(key):
                inp.miles_per_year = mpy
        except Exception:
            pass
    return inp


async def mileage_history(key: str) -> list[dict]:
    return await tiger.query(
        """SELECT time_bucket('1 week', time) AS week, max(value) AS odometer
           FROM events WHERE entity_id = %s AND metric = 'odometer'
           GROUP BY week ORDER BY week""",
        (f"driver:{key}",),
    )
