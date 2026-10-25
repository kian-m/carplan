# Contract reader benchmark: gemini-3.5-flash (2026-10-25T03:25:50+00:00)

48 reads of 4 contracts (PDF and phone photo, 6x each) against `http://localhost:8010`.

| Metric | Result |
|---|---|
| Field accuracy | **100.0%** (504/504 fields) |
| Reads with every field right | 100.0% |
| Personal data returned | 0 reads |
| Latency p50 / p95 | 5.11s / 8.86s |
| Errors | 0 |

| Field | Accuracy |
|---|---|
| kind | 100% |
| vin | 100% |
| year | 100% |
| make | 100% |
| model | 100% |
| monthly_payment | 100% |
| term_months | 100% |
| first_payment_date | 100% |
| residual_value | 100% |
| miles_allowed_per_year | 100% |
| excess_mile_fee | 100% |
| apr | 100% |
| amount_financed | 100% |

| Contract | Accuracy |
|---|---|
| sample-lease-rav4-hybrid.pdf (pdf) | 100% |
| sample-lease-rav4-hybrid.pdf (photo) | 100% |
| sample-loan-camry.pdf (pdf) | 100% |
| sample-loan-camry.pdf (photo) | 100% |
| sample-lease-honda-civic.pdf (pdf) | 100% |
| sample-lease-honda-civic.pdf (photo) | 100% |
| sample-loan-nissan-altima.pdf (pdf) | 100% |
| sample-loan-nissan-altima.pdf (photo) | 100% |
