"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Alert, Upload } from "@/app/icons";
import { carplan, INPUT_KEY, type ParsedContract, type Path, type PlanInput } from "@/lib/carplan";

type Kind = "lease" | "loan" | "owned";
type Errors = Record<string, string>;

const field = "w-full rounded-[3px] border border-tline px-3 py-2.5";

function monthsSince(iso?: string) {
  if (!iso) return 0;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 0;
  const now = new Date();
  return Math.max(0, (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth() + 1);
}

function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <span id={`${id}-error`} className="mt-1 flex gap-1 text-xs font-semibold text-tred">
      <Alert className="h-4 w-4 shrink-0" />
      {error}
    </span>
  );
}

type FieldProps = { id: string; label: string; value: string; onChange: (v: string) => void; error?: string };

function Num({ id, label, value, onChange, prefix, hint, error }: FieldProps & { prefix?: string; hint?: string }) {
  return (
    <label className="block">
      <span className="text-sm text-tgray">{label}</span>
      <div className="relative mt-1">
        {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tgray">{prefix}</span>}
        <input
          id={id}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${field} ${prefix ? "pl-7" : ""} ${error ? "field-error" : ""}`}
        />
      </div>
      {error ? <FieldError id={id} error={error} /> : hint && <span className="mt-1 block text-xs text-tgray">{hint}</span>}
    </label>
  );
}

function Text({ id, label, value, onChange, error }: FieldProps) {
  return (
    <label className="block">
      <span className="text-sm text-tgray">{label}</span>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${field} mt-1 ${error ? "field-error" : ""}`}
      />
      <FieldError id={id} error={error} />
    </label>
  );
}

function Step({ n, title, note, children }: { n: number; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 grid gap-4 sm:grid-cols-[2.5rem_1fr]">
      <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-black text-sm font-bold text-white">
        {n}
      </span>
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        {note && <p className="mt-1 text-sm text-tgray">{note}</p>}
        <div className="mt-4">{children}</div>
      </div>
    </section>
  );
}

function StartPage() {
  const router = useRouter();
  const params = useSearchParams();
  const path = (params.get("path") as Path) || "toyota";
  const editing = params.get("edit") === "1";

  const [vin, setVin] = useState("");
  const [car, setCar] = useState({ year: "", make: path === "toyota" ? "Toyota" : "", model: "", trim: "", odometer: "" });
  const [kind, setKind] = useState<Kind>("lease");
  const [c, setC] = useState({ payment: "", term: "36", elapsed: "", residual: "", allowed: "12000", fee: "0.15", apr: "", financed: "", lender: "" });
  const [money, setMoney] = useState({ income: "", bills: "", source: "manual" });
  const [miles, setMiles] = useState("12000");
  const [glossary, setGlossary] = useState<{ term: string; meaning: string }[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [base, setBase] = useState<PlanInput | null>(null); // the plan being edited, to keep name and flags

  // Editing a plan: fill the form back in with what the driver already entered.
  useEffect(() => {
    if (!editing) return;
    let saved: PlanInput | null = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(INPUT_KEY) ?? "null");
    } catch {}
    if (!saved) return;
    const str = (n: number | null | undefined) => (n ? String(n) : "");
    const v = saved.vehicle, k = saved.contract, f = saved.finances;
    setBase(saved);
    setVin(v.vin ?? "");
    setCar({ year: str(v.year), make: v.make, model: v.model, trim: v.trim ?? "", odometer: str(v.odometer) });
    setKind(k.kind);
    setC({
      payment: str(k.monthly_payment), term: str(k.term_months) || "36", elapsed: str(k.months_elapsed),
      residual: str(k.residual_value), allowed: str(k.miles_allowed_per_year) || "12000", fee: str(k.excess_mile_fee) || "0.15",
      apr: str(k.apr), financed: str(k.amount_financed), lender: k.lender ?? "",
    });
    setMoney({ income: str(Math.round(f.monthly_income)), bills: str(Math.round(f.monthly_bills)), source: f.source ?? "manual" });
    setMiles(str(saved.miles_per_year) || "12000");
  }, [editing]);

  // Fixing a field clears its error right away.
  const clear = (key: string) => setErrors((e) => (e[key] ? Object.fromEntries(Object.entries(e).filter(([k]) => k !== key)) : e));
  const setCarField = (k: keyof typeof car) => (v: string) => {
    clear(k);
    setCar((s) => ({ ...s, [k]: v }));
  };
  const setCField = (k: keyof typeof c) => (v: string) => {
    clear(k);
    setC((s) => ({ ...s, [k]: v }));
  };

  async function decode() {
    if (vin.trim().length !== 17) return setStatus("A VIN is 17 characters. You'll find it on your registration or insurance card.");
    setBusy(true);
    setStatus("Looking up your VIN…");
    try {
      const d = await carplan.decodeVin(vin.trim());
      if (!d.model) throw new Error(d.error ?? "We couldn't decode that VIN. Check it and try again.");
      setCar((s) => ({ ...s, year: d.year ?? s.year, make: d.make ? d.make[0] + d.make.slice(1).toLowerCase() : s.make, model: d.model ?? s.model, trim: d.trim?.split(",")[0] ?? s.trim }));
      setErrors({});
      setStatus(`Found your ${d.year} ${d.make} ${d.model}.`);
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    setBusy(true);
    setFileName(file.name);
    setStatus("Reading your contract. This takes about 10 seconds…");
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
      setErrors({});
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
      clear("income");
      setStatus("Connected. We only use your income and bills to check what fits your budget.");
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Every rule a field must pass before we can build a plan, keyed by the field's id.
  function validate(): Errors {
    const e: Errors = {};
    const n = (s: string) => Number(s);
    const thisYear = new Date().getFullYear();
    if (!car.year) e.year = "Add the year";
    else if (n(car.year) < 1990 || n(car.year) > thisYear + 1) e.year = `Use a year from 1990 to ${thisYear + 1}`;
    if (!car.make.trim()) e.make = "Add the make, like Toyota";
    if (!car.model.trim()) e.model = "Add the model, like RAV4";
    if (!car.odometer) e.odometer = "Add your current mileage. It's on the dashboard.";
    if (!n(miles)) e.miles = "Add about how far you drive a year";
    if (kind !== "owned") {
      if (!n(c.payment)) e.payment = "Add your monthly payment";
      if (!n(c.term)) e.term = "Add how many months your contract runs";
      else if (n(c.elapsed) > n(c.term)) e.elapsed = "This can't be more than the term";
      if (kind === "lease" && !n(c.residual)) e.residual = "Add your buyout price. It's on your contract.";
      if (kind === "loan" && !n(c.financed)) e.financed = "Add the amount you borrowed";
      if (kind === "loan" && c.apr === "") e.apr = "Add your interest rate";
    }
    if (!n(money.income)) e.income = "Add your monthly income, or connect your bank";
    return e;
  }

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const found = validate();
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      const el = document.getElementById(first);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus({ preventScroll: true });
      return;
    }
    const n = (s: string) => Number(s) || 0;
    const input: PlanInput = {
      ...(base ?? {}),
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

  const problems = Object.values(errors);

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-3xl pt-8">
      <Link href="/" className="text-sm text-tgray underline">
        Back
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
        {editing ? "Edit your details" : path === "toyota" ? "Tell us about your Toyota" : "Tell us about your car"}
      </h1>
      <p className="mt-2 text-tgray">Three short steps. About two minutes.</p>

      <section className="tcard mt-8 p-6">
        <h2 className="text-lg font-semibold">Fastest: add your lease or loan contract</h2>
        <p className="mt-1 text-sm text-tgray">Upload the PDF or snap a photo. We&rsquo;ll fill in the details and explain the fine print.</p>
        <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-[3px] border-2 border-dashed border-tline px-4 py-8 text-center transition-colors hover:border-tred hover:bg-[#fdecee]/40">
          <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-[#fdecee] text-tred">
            {busy && fileName ? (
              <span aria-hidden className="h-5 w-5 animate-spin rounded-full border-2 border-tline border-t-tred" />
            ) : (
              <Upload className="h-6 w-6" />
            )}
          </span>
          <span className="font-semibold">{fileName ?? "Choose a file or take a photo"}</span>
          <span className="mt-1 text-xs text-tgray">{fileName ? "Choose a different file" : "PDF, JPG or PNG up to 15 MB"}</span>
          <span className="mt-3 max-w-md text-xs text-tgray">
            Google&rsquo;s Gemini reads it for your car and payment terms only. We don&rsquo;t save your file. Feel free to
            cover your name, address and account numbers before you upload.
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
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {glossary.map((g) => (
              <div key={g.term} className="rounded-[3px] bg-tsurface p-3 text-sm">
                <dt className="font-semibold">{g.term}</dt>
                <dd className="mt-0.5 text-tgray">{g.meaning}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <Step n={1} title="Your car">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Num id="year" label="Year" value={car.year} onChange={setCarField("year")} error={errors.year} />
          <Text id="make" label="Make" value={car.make} onChange={setCarField("make")} error={errors.make} />
          <Text id="model" label="Model" value={car.model} onChange={setCarField("model")} error={errors.model} />
          <Text id="trim" label="Trim" value={car.trim} onChange={setCarField("trim")} />
          <Num id="odometer" label="Current mileage" value={car.odometer} onChange={setCarField("odometer")} hint="Check your dashboard" error={errors.odometer} />
          <Num
            id="miles"
            label="Miles you drive a year"
            value={miles}
            onChange={(v) => {
              clear("miles");
              setMiles(v);
            }}
            error={errors.miles}
          />
        </div>
      </Step>

      <Step n={2} title="How you pay for it">
        <div className="inline-flex rounded-full border border-tline p-1" role="radiogroup">
          {(["lease", "loan", "owned"] as Kind[]).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => {
                setKind(k);
                setErrors({});
              }}
              className={`rounded-full px-5 py-2 text-sm font-semibold ${kind === k ? "bg-black text-white" : ""}`}
            >
              {k === "lease" ? "Lease" : k === "loan" ? "Loan" : "Paid off"}
            </button>
          ))}
        </div>
        {kind !== "owned" && (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Num id="payment" label="Monthly payment" prefix="$" value={c.payment} onChange={setCField("payment")} error={errors.payment} />
            <Num id="term" label="Term (months)" value={c.term} onChange={setCField("term")} error={errors.term} />
            <Num id="elapsed" label="Payments made so far" value={c.elapsed} onChange={setCField("elapsed")} error={errors.elapsed} />
            {kind === "lease" ? (
              <>
                <Num
                  id="residual"
                  label="Buyout price at lease end"
                  prefix="$"
                  value={c.residual}
                  onChange={setCField("residual")}
                  hint="Your contract may call it the residual value or purchase option price."
                  error={errors.residual}
                />
                <Num id="allowed" label="Miles allowed a year" value={c.allowed} onChange={setCField("allowed")} />
                <Num id="fee" label="Charge per extra mile" prefix="$" value={c.fee} onChange={setCField("fee")} />
              </>
            ) : (
              <>
                <Num id="financed" label="Amount financed" prefix="$" value={c.financed} onChange={setCField("financed")} error={errors.financed} />
                <Num id="apr" label="Interest rate (APR %)" value={c.apr} onChange={setCField("apr")} error={errors.apr} />
              </>
            )}
            <Text id="lender" label="Lender" value={c.lender} onChange={setCField("lender")} />
          </div>
        )}
      </Step>

      <Step n={3} title="Your budget" note="So we only recommend options that fit. Nothing is stored.">
        <button type="button" onClick={connectBank} disabled={busy} className="btn-secondary">
          {money.source === "nessie" ? "Bank connected" : "Connect your bank (demo)"}
        </button>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <Num
            id="income"
            label="Monthly take-home pay"
            prefix="$"
            value={money.income}
            onChange={(v) => {
              clear("income");
              setMoney((m) => ({ ...m, income: v, source: "manual" }));
            }}
            error={errors.income}
          />
          <Num id="bills" label="Monthly bills (not counting your car)" prefix="$" value={money.bills} onChange={(v) => setMoney((m) => ({ ...m, bills: v, source: "manual" }))} />
        </div>
      </Step>

      {problems.length > 0 && (
        <div role="alert" className="mt-10 flex gap-3 rounded-[3px] border border-tred bg-[#fdecee] p-4 text-sm">
          <Alert className="h-5 w-5 shrink-0 text-tred" />
          <div>
            <p className="font-semibold">
              Fix {problems.length === 1 ? "this" : `these ${problems.length}`} to see your next move:
            </p>
            <ul className="mt-1 list-disc pl-5">
              {Object.entries(errors).map(([id, msg]) => (
                <li key={id}>
                  <button type="button" className="text-left underline" onClick={() => document.getElementById(id)?.focus()}>
                    {msg}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <button className="btn-primary mt-6 w-full sm:w-auto" disabled={busy}>
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
