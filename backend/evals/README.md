# Contract reader benchmark

CarPlan lets drivers photograph their lease or loan contract and Gemini fills in the form. This
benchmark checks that it reads contracts correctly and never returns personal data.

**How it works.** `contract_eval.py` uploads each sample contract in `/samples` to the real
`/api/contract/parse` endpoint, both as the original PDF and as a simulated phone photo (110 dpi,
tilted 2.5°, blurred, JPEG quality 60), several times each. Every extracted field is scored against
the answer key in `contracts.json` (numbers within 0.1%, dates and VINs exact). Every response is also
searched for the customer's name, address and contract numbers, which must never come back.

```
cd backend
uv run --group eval python evals/contract_eval.py                        # local backend
uv run --group eval python evals/contract_eval.py --base-url <prod url>  # production
```

It exits non-zero below 95% field accuracy or on any personal data, so it can gate a deploy.

## Results

| Run | Reads | Field accuracy | Perfect reads | Personal data returned | Latency p50 / p95 | Errors |
|---|---|---|---|---|---|---|
| gemini-3.5-flash | 48 | **100.0%** | 100% | 0 | 5.11s / 8.86s | 0 |
| gemini-3.8-flash | 24 | **90.5%** | 88% | 0 | 5.21s / 50.01s | 2 |
| gemini-3.1-pro-preview | 24 | **69.0%** | 50% | 0 | 5.61s / 11.65s | 7 |
| production | 24 | **100.0%** | 100% | 0 | 5.39s / 12.79s | 0 |

**What we changed because of it**

- The first run scored 73%: some Gemini calls stalled past 90 seconds and one read returned the year
  as `20245`. We added backup calls for slow reads and range checks that discard impossible values
  (a 5-digit year, a 15-character VIN) and re-read.
- Comparing models showed `gemini-3.5-flash` reads every field correctly with no throttling, while the
  larger `gemini-3.1-pro-preview` hit quota errors on our key. Contract reading now uses 3.5-flash
  (`GEMINI_CONTRACT_MODEL`); plan explanations stay on 3.8-flash.

Full per-read results, including every miss, are in `results/<run>.json`.
