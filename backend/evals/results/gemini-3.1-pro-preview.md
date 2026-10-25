# Contract reader benchmark: gemini-3.1-pro-preview (2026-10-25T03:22:13+00:00)

24 reads of 4 contracts (PDF and phone photo, 3x each) against `http://localhost:8010`.

| Metric | Result |
|---|---|
| Field accuracy | **69.0%** (174/252 fields) |
| Reads with every field right | 50.0% |
| Personal data returned | 0 reads |
| Latency p50 / p95 | 5.61s / 11.65s |
| Errors | 7 |

| Field | Accuracy |
|---|---|
| kind | 71% |
| vin | 58% |
| year | 71% |
| make | 71% |
| model | 71% |
| monthly_payment | 71% |
| term_months | 71% |
| first_payment_date | 71% |
| residual_value | 75% |
| miles_allowed_per_year | 75% |
| excess_mile_fee | 58% |
| apr | 67% |
| amount_financed | 67% |

| Contract | Accuracy |
|---|---|
| sample-lease-rav4-hybrid.pdf (pdf) | 100% |
| sample-lease-rav4-hybrid.pdf (photo) | 94% |
| sample-loan-camry.pdf (pdf) | 100% |
| sample-loan-camry.pdf (photo) | 90% |
| sample-lease-honda-civic.pdf (pdf) | 100% |
| sample-lease-honda-civic.pdf (photo) | 0% |
| sample-loan-nissan-altima.pdf (pdf) | 67% |
| sample-loan-nissan-altima.pdf (photo) | 0% |

## Misses

- sample-lease-rav4-hybrid.pdf (photo): excess_mile_fee expected 0.15 got None
- sample-lease-rav4-hybrid.pdf (photo): excess_mile_fee expected 0.15 got None
- sample-loan-camry.pdf (photo): vin expected '4T1G11AK8RU417806' got None
- sample-loan-camry.pdf (photo): vin expected '4T1G11AK8RU417806' got '4T1G11AKBRU417806'
- sample-loan-camry.pdf (photo): vin expected '4T1G11AK8RU417806' got '4T1G11AK8RU417805'
- sample-lease-honda-civic.pdf (photo): HTTPStatusError: Server error '500 Internal Server Error' for url 'http://localhost:8010/api/contract/parse'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/500
- sample-lease-honda-civic.pdf (photo): ReadError: 
- sample-lease-honda-civic.pdf (photo): HTTPStatusError: Server error '500 Internal Server Error' for url 'http://localhost:8010/api/contract/parse'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/500
- sample-loan-nissan-altima.pdf (pdf): ReadError: 
- sample-loan-nissan-altima.pdf (photo): HTTPStatusError: Server error '500 Internal Server Error' for url 'http://localhost:8010/api/contract/parse'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/500
- sample-loan-nissan-altima.pdf (photo): ReadError: 
- sample-loan-nissan-altima.pdf (photo): HTTPStatusError: Server error '500 Internal Server Error' for url 'http://localhost:8010/api/contract/parse'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/500
