"""Benchmark: does Gemini read vehicle contracts correctly?

Uploads each sample contract to the real /api/contract/parse endpoint, as the original PDF and
as a simulated phone photo, several times each, then scores every extracted field against the
ground truth in contracts.json. Also checks that no personal data comes back.

    uv run --group eval python evals/contract_eval.py                      # local backend
    uv run --group eval python evals/contract_eval.py --base-url https://…  # production
    uv run --group eval python evals/contract_eval.py --runs 5 --min-accuracy 0.98

Writes evals/results/latest.json and evals/results/latest.md. Exits 1 below --min-accuracy.
"""

import argparse
import asyncio
import io
import json
import statistics
import time
from datetime import datetime, timezone
from pathlib import Path

import pymupdf as fitz
import httpx
from PIL import Image, ImageFilter

HERE = Path(__file__).parent
SAMPLES = HERE.parent.parent / "samples"
RESULTS = HERE / "results"


def as_photo(pdf: bytes) -> bytes:
    """First page rendered like a quick phone snapshot: lower resolution, tilted, soft, JPEG."""
    page = fitz.open(stream=pdf, filetype="pdf")[0]
    img = Image.open(io.BytesIO(page.get_pixmap(dpi=110).tobytes("png"))).convert("RGB")
    img = img.rotate(2.5, expand=True, fillcolor=(200, 196, 188)).filter(ImageFilter.GaussianBlur(0.8))
    out = io.BytesIO()
    img.save(out, "JPEG", quality=60)
    return out.getvalue()


def matches(field: str, expected, got) -> bool:
    if got is None:
        return False
    if isinstance(expected, (int, float)) and not isinstance(expected, bool):
        try:
            return abs(float(got) - expected) <= max(0.01, abs(expected) * 0.001)
        except (TypeError, ValueError):
            return False
    e, g = str(expected).strip().lower(), str(got).strip().lower()
    if field in ("make", "model"):
        return e in g  # "RAV4 Hybrid" counts as RAV4
    return e == g


async def read_once(client: httpx.AsyncClient, name: str, variant: str, data: bytes, mime: str) -> dict:
    start = time.perf_counter()
    try:
        r = await client.post("/api/contract/parse", files={"file": (name, data, mime)})
        r.raise_for_status()
        return {"out": r.json(), "seconds": time.perf_counter() - start, "error": None}
    except Exception as e:
        return {"out": {}, "seconds": time.perf_counter() - start, "error": f"{type(e).__name__}: {e}"[:200]}


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default="http://localhost:8000")
    ap.add_argument("--runs", type=int, default=3, help="reads per contract per variant")
    ap.add_argument("--concurrency", type=int, default=4)
    ap.add_argument("--min-accuracy", type=float, default=0.95)
    ap.add_argument("--name", default="latest", help="results file name (evals/results/<name>.md)")
    args = ap.parse_args()

    truth = json.loads((HERE / "contracts.json").read_text())
    jobs = []
    for name in truth["contracts"]:
        pdf = (SAMPLES / name).read_bytes()
        for variant, data, mime in (("pdf", pdf, "application/pdf"), ("photo", as_photo(pdf), "image/jpeg")):
            jobs += [(name, variant, data, mime)] * args.runs

    sem = asyncio.Semaphore(args.concurrency)
    async with httpx.AsyncClient(base_url=args.base_url, timeout=90) as client:
        async def run(job):
            async with sem:
                return job, await read_once(client, *job)
        results = await asyncio.gather(*(run(j) for j in jobs))

    rows, field_hits, field_total, leaks, by_doc = [], {}, {}, [], {}
    for (name, variant, _, _), res in results:
        expected = truth["contracts"][name]
        wrong = {}
        for field, exp in expected.items():
            ok = matches(field, exp, res["out"].get(field))
            field_hits[field] = field_hits.get(field, 0) + ok
            field_total[field] = field_total.get(field, 0) + 1
            if not ok:
                wrong[field] = {"expected": exp, "got": res["out"].get(field)}
        text = json.dumps(res["out"]).lower()
        leaked = [p for p in truth["pii"] if p.lower() in text]
        if leaked:
            leaks.append({"contract": name, "variant": variant, "leaked": leaked})
        score = 1 - len(wrong) / len(expected)
        by_doc.setdefault((name, variant), []).append(score)
        rows.append({"contract": name, "variant": variant, "score": score, "seconds": round(res["seconds"], 2),
                     "terms_explained": len(res["out"].get("plain_language") or []), "wrong": wrong, "error": res["error"]})

    total_fields = sum(field_total.values())
    accuracy = sum(field_hits.values()) / total_fields
    perfect = sum(r["score"] == 1 for r in rows) / len(rows)
    secs = sorted(r["seconds"] for r in rows)
    summary = {
        "when": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "base_url": args.base_url,
        "reads": len(rows),
        "field_accuracy": round(accuracy, 4),
        "perfect_reads": round(perfect, 4),
        "privacy_leaks": len(leaks),
        "latency_p50_s": round(statistics.median(secs), 2),
        "latency_p95_s": round(secs[min(len(secs) - 1, int(len(secs) * 0.95))], 2),
        "errors": sum(1 for r in rows if r["error"]),
        "by_field": {f: round(field_hits[f] / field_total[f], 4) for f in field_total},
        "by_contract": {f"{n} ({v})": round(statistics.mean(s), 4) for (n, v), s in by_doc.items()},
    }

    RESULTS.mkdir(exist_ok=True)
    (RESULTS / f"{args.name}.json").write_text(json.dumps({"summary": summary, "leaks": leaks, "reads": rows}, indent=2, default=str))
    md = [
        f"# Contract reader benchmark: {args.name} ({summary['when']})",
        "",
        f"{summary['reads']} reads of {len(truth['contracts'])} contracts (PDF and phone photo, {args.runs}x each) against `{args.base_url}`.",
        "",
        "| Metric | Result |", "|---|---|",
        f"| Field accuracy | **{accuracy:.1%}** ({sum(field_hits.values())}/{total_fields} fields) |",
        f"| Reads with every field right | {perfect:.1%} |",
        f"| Personal data returned | {len(leaks)} reads |",
        f"| Latency p50 / p95 | {summary['latency_p50_s']}s / {summary['latency_p95_s']}s |",
        f"| Errors | {summary['errors']} |",
        "", "| Field | Accuracy |", "|---|---|",
        *[f"| {f} | {a:.0%} |" for f, a in summary["by_field"].items()],
        "", "| Contract | Accuracy |", "|---|---|",
        *[f"| {c} | {a:.0%} |" for c, a in summary["by_contract"].items()],
    ]
    misses = [r for r in rows if r["wrong"] or r["error"]]
    if misses:
        md += ["", "## Misses", ""]
        md += [f"- {r['contract']} ({r['variant']}): " + (r["error"] or ", ".join(
            f"{f} expected {w['expected']!r} got {w['got']!r}" for f, w in r["wrong"].items())) for r in misses]
    (RESULTS / f"{args.name}.md").write_text("\n".join(md) + "\n")
    print("\n".join(md))
    return 0 if accuracy >= args.min_accuracy and not leaks else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
