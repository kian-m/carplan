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
| Market value | Live | **SerpApi** Google search for "used {year} {make} {model} {trim} for sale Austin TX" (US results). We pull prices from listing sites, drop any under 50% or over 180% of our estimate, and need at least 3. **Value = middle (median) price.** |
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
| **Fuel** | Live | **EPA fueleconomy.gov** yearly fuel cost for the exact car (EPA figure at 15,000 miles), scaled to the driver's miles. $1,900 a year if the EPA has no match |
| **Maintenance (upkeep)** | Estimate | $450 a year for cars under 3, $750 for ages 3 to 5, $1,100 after. Other brands +20%. New Toyotas $0 for 2 years (ToyotaCare: 2 years / 25,000 miles) |
| **Insurance** | Estimate | $165 a month; new cars +8% |
| **Value loss (depreciation)** | Estimate | Per year: Toyota and Lexus 10%, Honda 11%, Subaru 11.5%, Mazda 12%, Hyundai and Kia 13%, Ford, Chevrolet and Nissan 14%, others 13%. +1% a year for every 3,000 miles over 12,000. New cars lose 15% the first year |
| **Sales tax** | Fact | Texas motor vehicle sales tax, 6.25% |
| **Dealer fees** | Fact-based | $225: the documentary fee the Texas OCCC presumes reasonable (dealers can charge more after filing) |
| **Lease return fee** | Fact (TFS) | Disposition fee up to $350, waived when you replace it with a new or certified Toyota through TFS |
| **Loan rates** | Example | New Toyota 5.49% for 60 months; Certified Used and buyouts 6.49% (buyout over 48 months). Labeled as examples, not offers |
| **New lease** | Example | 36 months, 60% residual, money factor 0.0021, 12,000 miles a year |
| **Certified Used price** | Estimate | 87% of the new price, for a 2-year-old model |
| **Toyota prices** | Estimate | Approximate starting MSRPs, e.g. Corolla Hybrid $25,000, Camry $29,500, RAV4 Hybrid $33,000 |

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
