# Contract reader benchmark: production-plain-glossary (2026-10-25T05:45:58+00:00)

24 reads of 4 contracts (PDF and phone photo, 3x each) against `https://carplan.tech`.

| Metric | Result |
|---|---|
| Field accuracy | **100.0%** (252/252 fields) |
| Reads with every field right | 100.0% |
| Personal data returned | 0 reads |
| Latency p50 / p95 | 4.37s / 7.44s |
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
