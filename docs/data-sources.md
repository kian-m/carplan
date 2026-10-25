# Where every number comes from

A cheat sheet for judging Q&A. **Live** means pulled from a real data source for this driver. **Estimate** means a fixed assumption in `backend/app/carplan/engine.py` (`ASSUMPTIONS`), shown to drivers under "How we calculated this". All math is deterministic; Gemini only writes the explanation.

## About the driver and their car

| Number | Live or estimate | Where it comes from |
|---|---|---|
| Year, make, model, trim | Live | **NHTSA vPIC** decodes the VIN, or Gemini reads it from the contract, or the driver types it |
| Lease/loan terms (payment, term, residual, APR, mile limit, per-mile fee) | Live | **Gemini** reads the uploaded contract (100% field accuracy in our benchmark), or the driver types them |
| Payments made so far | Live | Months since the first payment date on the contract |
| Current mileage | Driver | What the driver enters |
| Miles per year | Driver | What the driver enters (sample drivers have a set number). The slider can change it (3,000 to 30,000) |
| Income and bills | Live | **Capital One Nessie**: payroll deposits = income, bills minus the car payment = other bills. Or the driver types them |
| Open recalls | Live | **NHTSA recalls API** by year, make and model |

## What the car is worth

| Number | Live or estimate | How |
|---|---|---|
| Market value | Live | **SerpApi** Google search for "used {year} {make} {model} {trim} for sale Austin TX" (US results), plus a search without the trim when that finds fewer than 3 prices. We keep a price only when the model year written just before it (or the page title's year) matches the car, so a dealer page listing "2026 CR-V $34,662" doesn't price a 2022. We drop prices under 40% or over 200% of our estimate, need at least 3, and use the middle one. The last good result is saved in Tiger. Drivers can adjust it. |
| Value range shown | Live | 25th to 75th percentile of those listing prices |
| If too few listings | Estimate | Original price × 85% × 92% per year of age after the first, minus 8¢ per mile over 12,000 a year; never below 20% of original price |
| Driver's own value | Driver | The value slider overrides the estimate (80% of the low end to 120% of the high end) |
| Value at lease end | Estimate | Today's value, aged by our yearly value-loss rate for the months left on the lease |

## What they owe and what they'd pay

| Number | Live or estimate | How |
|---|---|---|
| Loan payoff | Calculated | Standard loan math from amount financed, APR, term and payments made |
| Lease buyout | Calculated | Residual value from the contract + a $300 purchase option fee (**our estimate**: TFS doesn't publish one; it varies by contract) |
| Equity | Calculated | What the car is worth − what they owe. Negative = "owes more than it's worth" → **GAP recommended** |
| Miles over the lease limit | Calculated | Mileage + miles per year × years left, minus the contract's allowance; × the contract's per-mile fee |
| Factory warranty left (Toyota) | Fact | Toyota basic warranty: 36 months or 36,000 miles, whichever comes first |

## Costs over the comparison period (3 years for Toyota drivers, 5 for other brands)

| Cost | Live or estimate | Value used |
|---|---|---|
| **Fuel** | Live | **EPA fueleconomy.gov** yearly fuel cost at 15,000 miles, scaled to the driver's miles. Your car: the EPA entry matching its trim (a 2023 Camry SE is "Camry LE/SE", the 2.5L). Comparison Toyotas: the EPA figure for each card's exact trim, e.g. used 2024 Camry SE (gas) $2,000, new Camry SE hybrid $1,400. $1,900 a year if the EPA has no match |
| **Maintenance (upkeep)** | Estimate | $450 a year for cars under 3, $750 for ages 3 to 5, $1,100 after. Other brands +20%. New Toyotas $0 for 2 years (ToyotaCare: 2 years / 25,000 miles) |
| **Insurance** | Estimate | $165 a month; new cars +8% |
| **Value loss (depreciation)** | Sourced | 10.3% a year for every brand: iSeeCars' 2026 study found the average car loses 41.8% over 5 years. +1% a year for every 3,000 miles over 12,000 (our estimate). New cars lose 15% the first year (our estimate) |
| **Sales tax** | Fact | Texas motor vehicle sales tax, 6.25% |
| **Dealer fees** | Fact-based | $225: the documentary fee the Texas OCCC presumes reasonable (dealers can charge more after filing) |
| **Lease return fee** | Fact (TFS) | Disposition fee up to $350, waived when you replace it with a new or certified Toyota through TFS |
| **Loan rates** | Example | New Toyota 5.49% for 60 months; Certified Used and buyouts 6.49% (buyout over 48 months). Labeled as examples, not offers |
| **New lease** | Example | 36 months, 60% residual, money factor 0.0021, 12,000 miles a year |
| **Certified Used price** | Checked by hand | Typical asking price at Austin-area dealers, Oct 2026: 2024 RAV4 Hybrid XLE $32,200, 2024 Corolla Hybrid LE $23,500, 2024 Camry SE $26,200 (Edmunds, Capital One, CarGurus, TrueCar, Cars.com). Other models: 87% of the new price (our estimate) |
| **Toyota prices** | Fact | Trim MSRP from toyota.com plus delivery (Toyota pricing sheet, Nov 2025): 2026 RAV4 XLE Premium $36,100 + $1,450, 2027 Corolla Hybrid LE $25,175 + $1,195, 2027 Camry SE $32,200 + $1,195. Other models: 2026 starting MSRP from toyota.com |

## How the recommendation is picked

1. Every option gets an **all-in cost** = payments + fuel + upkeep + insurance + fees − equity carried in − what the car is still worth at the end.
2. An option is **affordable** if its payment plus insurance is at most **20% of monthly income** and at most 60% of what's left after bills.
3. The **cheapest affordable option** wins. If none is affordable, the cheapest overall.
4. TFS products are added by fixed rules (owes more than it's worth → GAP; warranty ending → Vehicle Service Agreement; 15,000+ miles a year → Tire & Wheel; rebates only with a new Toyota; and so on). Each shows the reason in plain words.

## How we checked it

- **Contract reading:** 4 sample contracts as PDFs and phone photos, read 24 to 48 times per model. gemini-3.5-flash scored 100% of fields with 0 personal data returned (`backend/evals`).
- **End to end:** 27 browser tests cover every path, run against carplan.tech (`e2e/`).
- **Toyota claims:** every product description and policy (warranty, ToyotaCare, disposition fee waiver, Certified Used inspection, loan terms) was checked against toyotafinancial.com or toyota.com.
- **Reading level:** all driver-facing text graded with Flesch-Kincaid: grade 7.9 before, grade 4.5 after.
