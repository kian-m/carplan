from typing import Literal

from pydantic import BaseModel, Field


class Vehicle(BaseModel):
    vin: str | None = None
    year: int
    make: str
    model: str
    trim: str | None = None
    odometer: int
    msrp: float | None = None  # original MSRP, used when no market data is available


class Contract(BaseModel):
    kind: Literal["lease", "loan", "owned"]
    monthly_payment: float = 0
    term_months: int = 0
    months_elapsed: int = 0
    # Lease
    residual_value: float | None = None  # contract buyout price at lease end, before purchase-option fee
    miles_allowed_per_year: int | None = None
    excess_mile_fee: float = 0.15
    # Loan
    apr: float | None = None  # percent, e.g. 7.9
    amount_financed: float | None = None
    lender: str | None = None  # "TFS" for existing Toyota Financial customers


class Finances(BaseModel):
    monthly_income: float
    monthly_bills: float  # recurring bills excluding the current car payment
    checking_balance: float = 0
    source: str = "manual"  # "nessie" when pulled from the bank connection


class PlanInput(BaseModel):
    path: Literal["toyota", "other"]
    vehicle: Vehicle
    contract: Contract
    finances: Finances
    miles_per_year: int = 12000
    market_value: float | None = None  # user override; otherwise estimated
    flags: list[Literal["college", "military"]] = Field(default_factory=list)
    name: str | None = None


class CostBreakdown(BaseModel):
    payments: float = 0
    fuel: float = 0
    maintenance: float = 0
    insurance: float = 0
    fees: float = 0  # exit costs like excess-mileage charges
    equity_credit: float = 0  # equity applied or paid out at the start (reduces cost)
    equity_at_end: float = 0  # what you'd own at the end of the horizon (reduces cost)


class Option(BaseModel):
    id: Literal["buy_out", "keep", "new_toyota", "certified_used", "go_flexible"]
    title: str
    vehicle_label: str
    monthly_payment: float  # cash leaving your account each month for the car itself
    true_monthly_cost: float  # everything over the horizon, divided by months
    total_cost: float
    breakdown: CostBreakdown
    affordable: bool
    notes: list[str] = Field(default_factory=list)
    tfs_products: list[str] = Field(default_factory=list)  # keys into tfs.PRODUCTS
    loan_to_value: float | None = None  # amount financed / vehicle value at the start


class Recommendation(BaseModel):
    product: str  # key into tfs.PRODUCTS
    name: str
    category: str
    reason: str
    url: str
    priority: Literal["high", "medium", "low"]


class Situation(BaseModel):
    market_value: float
    market_value_low: float
    market_value_high: float
    market_value_method: Literal["listings", "estimate", "user"]
    market_value_sources: list[dict] = Field(default_factory=list)
    payoff: float  # what you owe today (loan) or the lease buyout at lease end
    equity: float  # market value minus payoff (negative = underwater)
    months_remaining: int
    projected_odometer_at_end: int | None = None
    projected_excess_miles: int = 0
    projected_excess_fee: float = 0
    warranty_basic_months_left: int | None = None


class Plan(BaseModel):
    horizon_months: int
    situation: Situation
    options: list[Option]
    recommended: str  # Option.id
    recommendations: list[Recommendation]
    toyota_equivalent: str | None = None
    assumptions: dict
    disclosure: str
