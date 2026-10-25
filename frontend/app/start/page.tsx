"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { carplan, INPUT_KEY, type ParsedContract, type Path, type PlanInput } from "@/lib/carplan";

type Kind = "lease" | "loan" | "owned";

const field = "w-full rounded-[3px] border border-tline px-3 py-2.5";

function monthsSince(iso?: string) {
  if (!iso) return 0;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 0;
  const now = new Date();
  return Math.max(0, (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth() + 1);
}

function Num({ label, value, onChange, prefix, hint }: { label: string; value: string; onChange: (v: string) => void; prefix?: string; hint?: string }) {
  return (
    <label className="block">
      <span className="text-sm text-tgray">{label}</span>
      <div className="relative mt-1">
        {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tgray">{prefix}</span>}
        <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))} className={`${field} ${prefix ? "pl-7" : ""}`} />
      </div>
      {hint && <span className="mt-1 block text-xs text-tgray">{hint}</span>}
    </label>
  );
}

function Text({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm text-tgray">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className={`${field} mt-1`} />
    </label>
  );
}

function StartPage() {
  const router = useRouter();
  const path = (useSearchParams().get("path") as Path) || "toyota";

  const [vin, setVin] = useState("");
  const [car, setCar] = useState({ year: "", make: path === "toyota" ? "Toyota" : "", model: "", trim: "", odometer: "" });
  const [kind, setKind] = useState<Kind>("lease");
  const [c, setC] = useState({ payment: "", term: "36", elapsed: "", residual: "", allowed: "12000", fee: "0.15", apr: "", financed: "", lender: "" });
  const [money, setMoney] = useState({ income: "", bills: "", source: "manual" });
  const [miles, setMiles] = useState("12000");
  const [glossary, setGlossary] = useState<{ term: string; meaning: string }[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setCarField = (k: keyof typeof car) => (v: string) => setCar((s) => ({ ...s, [k]: v }));
  const setCField = (k: keyof typeof c) => (v: string) => setC((s) => ({ ...s, [k]: v }));

  async function decode() {
    if (vin.trim().length !== 17) return setStatus("A VIN is 17 characters. You'll find it on your registration or insurance card.");
    setBusy(true);
    setStatus("Looking up your VIN…");
    try {
      const d = await carplan.decodeVin(vin.trim());
      if (!d.model) throw new Error(d.error ?? "We couldn't decode that VIN. Check it and try again.");
      setCar((s) => ({ ...s, year: d.year ?? s.year, make: d.make ? d.make[0] + d.make.slice(1).toLowerCase() : s.make, model: d.model ?? s.model, trim: d.trim?.split(",")[0] ?? s.trim }));
      setStatus(`Found your ${d.year} ${d.make} ${d.model}.`);
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    setBusy(true);
    setStatus("Reading your contract…");
    try {
      const p: ParsedContract = await carplan.parseContract(file);
      if (p.vin) setVin(p.vin);
      setCar((s) => ({
        year: p.year ? String(p.year) : s.year,
        make: p.make ?? s.make,
        model: p.model ?? s.model,
        trim: p.trim ?? s.trim,
        odometer: s.odometer,
      }));
      if (p.kind) setKind(p.kind);
      setC((s) => ({
        payment: p.monthly_payment ? String(p.monthly_payment) : s.payment,
        term: p.term_months ? String(p.term_months) : s.term,
        elapsed: p.first_payment_date ? String(monthsSince(p.first_payment_date)) : s.elapsed,
        residual: p.residual_value ? String(p.residual_value) : s.residual,
        allowed: p.miles_allowed_per_year ? String(p.miles_allowed_per_year) : s.allowed,
        fee: p.excess_mile_fee ? String(p.excess_mile_fee) : s.fee,
        apr: p.apr ? String(p.apr) : s.apr,
        financed: p.amount_financed ? String(p.amount_financed) : s.financed,
        lender: p.lender ?? s.lender,
      }));
      setGlossary(p.plain_language ?? []);
      setStatus("We filled in what we found. Check the details below.");
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function connectBank() {
    setBusy(true);
    setStatus("Connecting to your bank…");
    try {
      // Demo bank (Capital One Nessie): uses a sample account's real balances, bills and paychecks.
      const sample = await carplan.driver(path === "toyota" ? "maria" : "jordan");
      setMoney({
        income: String(Math.round(sample.finances.monthly_income)),
        bills: String(Math.round(sample.finances.monthly_bills)),
        source: "nessie",
      });
      setStatus("Connected. We only use your income and bills to check what fits your budget.");
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = (s: string) => Number(s) || 0;
    if (!car.year || !car.make || !car.model) return setStatus("Add your car's year, make and model, or enter your VIN.");
    if (!money.income) return setStatus("Add your monthly income, or connect your bank.");
    const input: PlanInput = {
      path: car.make.trim().toLowerCase() === "toyota" ? "toyota" : "other",
      vehicle: { vin: vin || null, year: n(car.year), make: car.make.trim(), model: car.model.trim(), trim: car.trim || null, odometer: n(car.odometer) },
      contract: {
        kind,
        monthly_payment: n(c.payment),
        term_months: n(c.term),
        months_elapsed: n(c.elapsed),
        residual_value: kind === "lease" ? n(c.residual) : null,
        miles_allowed_per_year: kind === "lease" ? n(c.allowed) : null,
        excess_mile_fee: n(c.fee) || 0.15,
        apr: kind === "loan" ? n(c.apr) : null,
        amount_financed: kind === "loan" ? n(c.financed) : null,
        lender: c.lender || null,
      },
      finances: { monthly_income: n(money.income), monthly_bills: n(money.bills), source: money.source },
      miles_per_year: n(miles) || 12000,
    };
    sessionStorage.setItem(INPUT_KEY, JSON.stringify(input));
    router.push("/plan");
  }

  return (
    <form onSubmit={submit} className="pt-8">
      <Link href="/" className="text-sm text-tgray underline">
        Back
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">{path === "toyota" ? "Tell us about your Toyota" : "Tell us about your car"}</h1>

      <section className="tcard mt-6">
        <h2 className="text-lg font-semibold">Fastest: add your lease or loan contract</h2>
        <p className="mt-1 text-sm text-tgray">Upload the PDF or snap a photo. We&rsquo;ll fill in the details and explain the fine print.</p>
        <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-[3px] border-2 border-dashed border-tline px-4 py-8 text-center hover:border-tred">
          <span className="font-semibold">Choose a file or take a photo</span>
          <span className="mt-1 text-xs text-tgray">PDF, JPG or PNG up to 15 MB</span>
          <span className="mt-3 max-w-md text-xs text-tgray">
            We only read your car and payment terms. Your file isn&rsquo;t saved. Feel free to cover your name, address
            and account numbers before you upload.
          </span>
          <input
            type="file"
            accept="application/pdf,image/*"
            capture="environment"
            className="sr-only"
            disabled={busy}
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
        </label>
        <div className="mt-4 flex gap-2">
          <input value={vin} onChange={(e) => setVin(e.target.value.toUpperCase())} placeholder="Or enter your 17-character VIN" maxLength={17} className={`${field} font-mono`} />
          <button type="button" onClick={decode} disabled={busy} className="btn-secondary shrink-0 !px-5 !py-2">
            Look up
          </button>
        </div>
        {status && (
          <p className="mt-3 text-sm" role="status">
            {status}
          </p>
        )}
        {glossary.length > 0 && (
          <dl className="mt-4 space-y-2 bg-tsurface p-4 text-sm">
            {glossary.map((g) => (
              <div key={g.term}>
                <dt className="font-semibold">{g.term}</dt>
                <dd className="text-tgray">{g.meaning}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Your car</h2>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Num label="Year" value={car.year} onChange={setCarField("year")} />
          <Text label="Make" value={car.make} onChange={setCarField("make")} />
          <Text label="Model" value={car.model} onChange={setCarField("model")} />
          <Text label="Trim" value={car.trim} onChange={setCarField("trim")} />
          <Num label="Current mileage" value={car.odometer} onChange={setCarField("odometer")} />
          <Num label="Miles you drive a year" value={miles} onChange={setMiles} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">How you pay for it</h2>
        <div className="mt-3 inline-flex rounded-full border border-tline p-1" role="radiogroup">
          {(["lease", "loan", "owned"] as Kind[]).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={`rounded-full px-5 py-2 text-sm font-semibold ${kind === k ? "bg-black text-white" : ""}`}
            >
              {k === "lease" ? "Lease" : k === "loan" ? "Loan" : "Paid off"}
            </button>
          ))}
        </div>
        {kind !== "owned" && (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Num label="Monthly payment" prefix="$" value={c.payment} onChange={setCField("payment")} />
            <Num label="Term (months)" value={c.term} onChange={setCField("term")} />
            <Num label="Payments made so far" value={c.elapsed} onChange={setCField("elapsed")} />
            {kind === "lease" ? (
              <>
                <Num label="Buyout price at lease end" prefix="$" value={c.residual} onChange={setCField("residual")} hint="Called the residual value or purchase option price" />
                <Num label="Miles allowed a year" value={c.allowed} onChange={setCField("allowed")} />
                <Num label="Charge per extra mile" prefix="$" value={c.fee} onChange={setCField("fee")} />
              </>
            ) : (
              <>
                <Num label="Amount financed" prefix="$" value={c.financed} onChange={setCField("financed")} />
                <Num label="Interest rate (APR %)" value={c.apr} onChange={setCField("apr")} />
              </>
            )}
            <Text label="Lender" value={c.lender} onChange={setCField("lender")} />
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Your budget</h2>
        <p className="mt-1 text-sm text-tgray">So we only recommend options that fit. Nothing is stored.</p>
        <button type="button" onClick={connectBank} disabled={busy} className="btn-secondary mt-3">
          {money.source === "nessie" ? "Bank connected" : "Connect your bank (demo)"}
        </button>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <Num label="Monthly take-home pay" prefix="$" value={money.income} onChange={(v) => setMoney((m) => ({ ...m, income: v, source: "manual" }))} />
          <Num label="Monthly bills (not counting your car)" prefix="$" value={money.bills} onChange={(v) => setMoney((m) => ({ ...m, bills: v, source: "manual" }))} />
        </div>
      </section>

      <button className="btn-primary mt-10 w-full sm:w-auto" disabled={busy}>
        See my next move
      </button>
    </form>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="pt-16 text-tgray">Loading…</p>}>
      <StartPage />
    </Suspense>
  );
}
