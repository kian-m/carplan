"""Sample drivers for the demo. Each is seeded into Nessie (bank), and their income and bills
are read back from it, with the static values below as a fallback so the demo never breaks.
"""

from datetime import date, timedelta

from app.carplan.models import Contract, Finances, PlanInput, Vehicle
from app.integrations import nessie

ADDRESS = {"street_number": "2100", "street_name": "Speedway", "city": "Austin", "state": "TX", "zip": "78712"}

DRIVERS: dict[str, dict] = {
    "maria": {
        "first": "Maria", "last": "Lopez",
        "tagline": "Lease ends in 3 months",
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
        "tagline": "Car loan, owes more than it's worth",
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
        "tagline": "Lease ends in 6 months, over on miles",
        "input": PlanInput(
            path="other", name="Jordan",
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
    # A TFS customer with a lease ending and lots of miles: a newer Certified Used car, plus repeat
    # customer offers, Tire & Wheel and insurance. The plan page also lists every TFS service.
    "taylor": {
        "first": "Taylor", "last": "Nguyen",
        "tagline": "Lease ending, drives 20k miles a year",
        "input": PlanInput(
            path="toyota", name="Taylor",
            vehicle=Vehicle(vin="4T1G11AK5PU123456", year=2023, make="Toyota", model="Camry", trim="SE",
                            odometer=44000, msrp=29500),
            contract=Contract(kind="lease", monthly_payment=399, term_months=36, months_elapsed=34,
                              residual_value=21500, miles_allowed_per_year=12000, excess_mile_fee=0.15, lender="TFS"),
            finances=Finances(monthly_income=5200, monthly_bills=1995, checking_balance=3900),
            miles_per_year=20000,
        ),
        "income": 5200, "checking": 3900,
        "bills": [("West Campus Apartments", 1500), ("Austin Energy", 150), ("Visible Wireless", 45),
                  ("Gold's Gym", 60), ("Nelnet Student Loan", 240), ("Toyota Financial Services", 399)],
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


async def seed() -> dict:
    """Idempotent: creates any missing Nessie customers, accounts, bills and paychecks."""
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


async def load(key: str) -> PlanInput:
    inp = DRIVERS[key]["input"].model_copy(deep=True)
    if nessie.configured():
        try:
            if fin := await _finances_from_nessie(key):
                inp.finances = fin
        except Exception:
            pass
    return inp
