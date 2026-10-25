# Contract reader benchmark: gemini-3.8-flash (2026-10-25T03:24:05+00:00)

24 reads of 4 contracts (PDF and phone photo, 3x each) against `http://localhost:8010`.

| Metric | Result |
|---|---|
| Field accuracy | **90.5%** (228/252 fields) |
| Reads with every field right | 87.5% |
| Personal data returned | 0 reads |
| Latency p50 / p95 | 5.21s / 50.01s |
| Errors | 2 |

| Field | Accuracy |
|---|---|
| kind | 92% |
| vin | 88% |
| year | 88% |
| make | 92% |
| model | 92% |
| monthly_payment | 88% |
| term_months | 88% |
| first_payment_date | 92% |
| residual_value | 100% |
| miles_allowed_per_year | 100% |
| excess_mile_fee | 100% |
| apr | 83% |
| amount_financed | 83% |

| Contract | Accuracy |
|---|---|
| sample-lease-rav4-hybrid.pdf (pdf) | 100% |
| sample-lease-rav4-hybrid.pdf (photo) | 100% |
| sample-loan-camry.pdf (pdf) | 100% |
| sample-loan-camry.pdf (photo) | 87% |
| sample-lease-honda-civic.pdf (pdf) | 100% |
| sample-lease-honda-civic.pdf (photo) | 100% |
| sample-loan-nissan-altima.pdf (pdf) | 33% |
| sample-loan-nissan-altima.pdf (photo) | 100% |

## Misses

- sample-loan-camry.pdf (photo): vin expected '4T1G11AK8RU417806' got None, year expected 2024 got None, monthly_payment expected 676.64 got None, term_months expected 72 got None
- sample-loan-nissan-altima.pdf (pdf): HTTPStatusError: Server error '504 Gateway Timeout' for url 'http://localhost:8010/api/contract/parse'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/504
- sample-loan-nissan-altima.pdf (pdf): HTTPStatusError: Server error '504 Gateway Timeout' for url 'http://localhost:8010/api/contract/parse'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/504
