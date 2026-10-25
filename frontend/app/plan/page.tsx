"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  carplan,
  INPUT_KEY,
  usd,
  type Explanation,
  type Option,
  type PlanInput,
  type PlanResponse,
  type TfsRecommendation,
} from "@/lib/carplan";

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// Briefly highlights its contents when `value` changes, so slider effects are visible.
function Live({ value, children, className = "" }: { value: unknown; children: React.ReactNode; className?: string }) {
  const first = useRef(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setTick((t) => t + 1);
  }, [value]);
  return (
    <span key={tick} className={`${tick ? "flash" : ""} ${className}`}>
      {children}
    </span>
  );
}

function situationLine(input: PlanInput, months: number) {
  const c = input.contract;
  if (c.kind === "lease") return months > 0 ? `Lease ends in ${months} month${months === 1 ? "" : "s"}` : "Lease ending now";
  if (c.kind === "loan") return `${months} loan payments left`;
  return "Paid off";
}

// --- answer --------------------------------------------------------------

function Answer({
  input,
  data,
  explanation,
  gap,
  updating,
}: {
  input: PlanInput;
  data: PlanResponse;
  explanation: Explanation | null;
  gap?: TfsRecommendation;
  updating: boolean;
}) {
  const best = data.plan.options.find((o) => o.id === data.plan.recommended)!;
  const v = input.vehicle;
  const cta = data.plan.next_step;

  return (
    <section className="tcard mt-6 p-6 sm:p-8">
      <p className="text-sm text-tgray">
        {input.name ? `${input.name}'s ` : "Your "}
        {v.year} {v.make} {v.model}
        {v.trim ? ` ${v.trim}` : ""} · {situationLine(input, data.plan.situation.months_remaining)}
      </p>

      {explanation ? (
        <div className={updating ? "opacity-50 transition-opacity" : "transition-opacity"} aria-busy={updating}>
          {updating && <p className="mt-2 text-xs font-semibold text-tred">Updating for your changes…</p>}
          <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{explanation.headline}</h1>
          <p className="mt-3 text-lg">{explanation.summary}</p>
          <ul className="mt-5 space-y-3">
            {explanation.reasons.map((r) => (
              <li key={r} className="flex gap-3">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-tred" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{best.title}.</h1>
          <div className="mt-4 space-y-3" aria-label="Writing your explanation">
            <div className="h-4 w-4/5 animate-pulse rounded bg-tsurface" />
            <div className="h-4 w-3/5 animate-pulse rounded bg-tsurface" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-tsurface" />
          </div>
        </>
      )}

      {gap && (
        <div className="mt-6 border-l-4 border-tred bg-tsurface p-4">
          <p className="font-semibold">Protect yourself with GAP</p>
          <p className="mt-1 text-sm">{gap.reason}</p>
          <a href={gap.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-tred underline">
            Learn about GAP
          </a>
        </div>
      )}

      <div className="mt-7 flex flex-wrap gap-3">
        <a href={cta.url} target="_blank" rel="noreferrer" className="btn-primary">
          {cta.label}
        </a>
        <a href="#options" className="btn-secondary">
          Compare all options
        </a>
      </div>
    </section>
  );
}

// --- adjusters -------------------------------------------------------------

function Adjusters({
  data,
  value,
  setValue,
  miles,
  setMiles,
}: {
  data: PlanResponse;
  value: number;
  setValue: (n: number) => void;
  miles: number;
  setMiles: (n: number) => void;
}) {
  const s = data.plan.situation;
  const lease = data.input.contract.kind === "lease";
  const min = Math.round((s.market_value_low * 0.8) / 100) * 100;
  const max = Math.round((s.market_value_high * 1.2) / 100) * 100;
  const sources = s.market_value_sources;

  return (
    <section className="mt-6 grid gap-5 sm:grid-cols-2">
      <div className="rounded-[3px] border border-tline p-5">
        <label htmlFor="value" className="text-sm text-tgray">
          What your car is worth today
        </label>
        <p className="mt-1 text-3xl font-bold tabular-nums">{usd(value)}</p>
        <input
          id="value"
          type="range"
          min={min}
          max={max}
          step={100}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="mt-3 w-full"
        />
        <p className="mt-2 text-xs text-tgray">
          {s.market_value_method === "listings" || (s.market_value_method === "user" && sources.length)
            ? `Similar cars near Austin sell for ${usd(s.market_value_low)} to ${usd(s.market_value_high)} (from ${sources.length} websites). `
            : `Estimated from the car’s original price, age and miles. `}
          New tires or a dent? Slide to change it.
        </p>
        {sources.length > 0 && (
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer text-tgray underline">See the listings</summary>
            <ul className="mt-2 space-y-1">
              {sources.map((src) => (
                <li key={src.url}>
                  <a href={src.url} target="_blank" rel="noreferrer" className="underline">
                    {src.title}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className="rounded-[3px] border border-tline p-5">
        <label htmlFor="miles" className="text-sm text-tgray">
          Miles you drive a year
        </label>
        <p className="mt-1 text-3xl font-bold tabular-nums">{miles.toLocaleString()}</p>
        <input
          id="miles"
          type="range"
          min={3000}
          max={30000}
          step={500}
          value={miles}
          onChange={(e) => setMiles(Number(e.target.value))}
          className="mt-3 w-full"
        />
        <p className="mt-2 text-xs text-tgray">
          {lease && s.projected_excess_miles > 0
            ? `At this rate you’ll go ${s.projected_excess_miles.toLocaleString()} miles over your lease limit. That’s ${usd(s.projected_excess_fee)} in fees if you return it.`
            : "Based on your recent driving. Change it to see if your best move changes."}
        </p>
      </div>

      <div className="rounded-[3px] bg-tsurface p-5 sm:col-span-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p>
            {lease ? "Your buyout price at lease end" : "What you owe today"}:{" "}
            <span className="font-semibold tabular-nums">{usd(s.payoff)}</span>
          </p>
          <Live value={Math.round(s.equity)} className={s.equity >= 0 ? "font-semibold text-tgreen" : "font-semibold text-tred"}>
            {s.equity >= 0
              ? `${usd(s.equity)} in equity`
              : `${usd(-s.equity)} more than it's worth`}
          </Live>
        </div>
        {s.equity >= 1 && data.input.contract.kind !== "owned" && (
          <p className="mt-1 text-sm text-tgray">If you switch cars, that money goes toward your next one.</p>
        )}
        {s.equity < 0 && (
          <p className="mt-1 text-sm text-tgray">If you switch cars, this amount gets added to your new loan.</p>
        )}
      </div>
    </section>
  );
}

// --- other brands: your car vs. the Toyota -----------------------------------

function Compare({ data }: { data: PlanResponse }) {
  const a = data.plan.assumptions as Record<string, number & Record<string, number>>;
  const v = data.input.vehicle;
  const target = data.plan.toyota_equivalent;
  const scale = data.input.miles_per_year / 15000;
  const dep = a.depreciation_per_year;
  const rate = (make: string) => dep[make.toLowerCase()] ?? dep.default;
  const rows: [string, string, string][] = [
    ["Gas a year", usd(data.fuel.current_annual * scale), usd(data.fuel.toyota_annual * scale)],
    ["Value lost a year", `${Math.round(rate(v.make) * 100)}%`, `${Math.round(rate("toyota") * 100)}%`],
    ["Free scheduled service", "None", "2 years (new)"],
  ];
  return (
    <section className="mt-6 rounded-[3px] border border-tline p-5">
      <h2 className="text-lg font-semibold">
        Your {v.model} vs. a {target}
      </h2>
      <table className="mt-3 w-full text-sm tabular-nums">
        <thead>
          <tr className="text-left text-tgray">
            <th className="py-1 font-normal" />
            <th className="py-1 font-normal">Your {v.model}</th>
            <th className="py-1 font-normal">{target}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, mine, toyota]) => (
            <tr key={k} className="border-t border-tline">
              <th className="py-2 pr-3 text-left font-normal text-tgray">{k}</th>
              <td className="py-2 pr-3">{mine}</td>
              <td className="py-2 font-semibold">{toyota}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// --- how we calculated this ------------------------------------------------

function Assumptions({ data }: { data: PlanResponse }) {
  const a = data.plan.assumptions as Record<string, number & Record<string, number>>;
  const pct = (n: number) => `${+(n * 100).toFixed(2)}%`;
  const m = a.maintenance_per_year;
  const value = {
    listings: "the middle price of similar cars for sale near Austin",
    user: "the number you set",
    estimate: "an estimate from the car’s original price, age and miles",
  }[data.plan.situation.market_value_method];
  return (
    <ul className="list-disc space-y-2 pl-5">
      <li>Car value: {value}.</li>
      <li>
        Gas: the EPA says your car costs {usd(data.fuel.current_annual)} a year to fuel, and the {data.plan.toyota_equivalent}{" "}
        {usd(data.fuel.toyota_annual)}, at 15,000 miles. We adjusted for your {data.input.miles_per_year.toLocaleString()} miles.
      </li>
      <li>
        Loan rates: {a.new_apr}% for a new Toyota, {a.certified_used_apr}% for Certified Used or a buyout. {a.rates_disclaimer}
      </li>
      <li>
        Taxes and fees: Texas sales tax of {pct(a.sales_tax_rate)} and {usd(a.dealer_fees)} in dealer fees.
      </li>
      <li>
        Insurance: about {usd(a.insurance_monthly)} a month, and {pct(a.new_car_insurance_multiplier - 1)} more for a new car.
      </li>
      <li>
        Upkeep: {usd(m["0-2"])} a year for cars under 3 years old, {usd(m["3-5"])} for 3 to 5 years, and {usd(m["6+"])} after
        that. Other brands cost {pct(a.non_toyota_maintenance_multiplier - 1)} more. New Toyotas get 2 years of free service.
      </li>
      <li>
        Value loss: about {pct(a.depreciation_per_year.toyota)} a year for a Toyota, more for most other brands, and more if you
        drive over 12,000 miles a year.
      </li>
      <li>Our math follows fixed rules. AI only writes the words you read.</li>
    </ul>
  );
}

// --- options -------------------------------------------------------------

function OptionCard({ o, best, years }: { o: Option; best: boolean; years: number }) {
  const [open, setOpen] = useState(false);
  const b = o.breakdown;
  const rows: [string, number][] = [
    ["Payments", b.payments],
    ["Fuel", b.fuel],
    ["Maintenance", b.maintenance],
    ["Insurance", b.insurance],
    ["Fees", b.fees],
    ["Equity applied", -b.equity_credit],
    ["What you'd own at the end", -b.equity_at_end],
  ];
  return (
    <article
      className={
        best
          ? "tcard relative flex flex-col"
          : "flex flex-col rounded-[3px] border border-tline bg-white p-5"
      }
    >
      {best && (
        <span className="absolute -top-3 left-4 rounded-full bg-tred px-3 py-0.5 text-xs font-semibold text-white">
          Best for you
        </span>
      )}
      <h3 className="text-lg font-semibold">{o.title}</h3>
      <p className="text-sm text-tgray">{o.vehicle_label}</p>
      <p className="mt-4 text-3xl font-bold tabular-nums">
        <Live value={Math.round(o.true_monthly_cost)}>{usd(o.true_monthly_cost)}</Live>
        <span className="text-base font-normal text-tgray">/mo all-in</span>
      </p>
      <p className="mt-1 text-sm">
        Monthly payment{" "}
        <Live value={Math.round(o.monthly_payment)} className="font-semibold tabular-nums">
          {usd(o.monthly_payment)}
        </Live>
      </p>
      {!o.affordable && (
        <p className="mt-2 text-sm font-semibold text-tred">Above the 20% of income we recommend for car costs</p>
      )}
      <ul className="mt-3 space-y-1.5 text-sm text-tgray">
        {o.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
      <button onClick={() => setOpen(!open)} className="mt-auto pt-4 text-left text-sm font-semibold underline" aria-expanded={open}>
        {open ? "Hide the math" : "Show the math"}
      </button>
      {open && (
        <dl className="mt-2 space-y-1 text-sm tabular-nums">
          {rows
            .filter(([, n]) => Math.round(n) !== 0)
            .map(([k, n]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-tgray">{k}</dt>
                <dd>{usd(n)}</dd>
              </div>
            ))}
          <div className="flex justify-between gap-4 border-t border-tline pt-1 font-semibold">
            <dt>Total over {years} years</dt>
            <dd>{usd(o.total_cost)}</dd>
          </div>
        </dl>
      )}
    </article>
  );
}

// --- TFS products ----------------------------------------------------------

function Products({ recs, disclosure }: { recs: TfsRecommendation[]; disclosure: string }) {
  if (!recs.length) return null;
  return (
    <section className="mt-12">
      <h2 className="text-2xl font-bold tracking-tight">Toyota Financial Services can help</h2>
      <ul className="mt-5 divide-y divide-tline border-y border-tline">
        {recs.map((r) => (
          <li key={r.product} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div>
              <p className="font-semibold">
                {r.name}
                {r.priority === "high" && (
                  <span className="ml-2 rounded-full bg-tred px-2 py-0.5 align-middle text-xs font-semibold text-white">
                    Recommended
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm text-tgray">{r.reason}</p>
            </div>
            <a href={r.url} target="_blank" rel="noreferrer" className="shrink-0 text-sm font-semibold text-tred underline">
              Learn more
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-tgray">{disclosure}</p>
    </section>
  );
}

// --- recall alerts -----------------------------------------------------------

function RecallAlerts({ input }: { input: PlanInput }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const v = input.vehicle;
  const car = `${v.make} ${v.model}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    try {
      const r = await carplan.subscribe({ email, year: v.year, make: v.make, model: v.model, vin: v.vin });
      setState("done");
      const recalls = r.open_recalls
        ? `Your ${car} has ${r.open_recalls} open safety recall${r.open_recalls === 1 ? "" : "s"} right now.`
        : `Your ${car} has no open safety recalls right now.`;
      setMsg(`${r.email_sent ? "Check your inbox. " : ""}${recalls} We'll email you if that changes.`);
    } catch (err) {
      setState("error");
      setMsg((err as Error).message);
    }
  }

  return (
    <section className="tcard mt-12">
      <h2 className="text-xl font-semibold">Get free recall alerts for your {car}</h2>
      <p className="mt-1 text-tgray">
        We&rsquo;ll email you if there&rsquo;s a safety recall on your car. It&rsquo;s free, and you can unsubscribe anytime.
      </p>
      {state === "done" ? (
        <p className="mt-4 font-semibold" role="status">
          Alerts are on. {msg}
        </p>
      ) : (
        <form onSubmit={submit} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <label htmlFor="email" className="sr-only">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="min-w-0 flex-1 rounded-full border border-tline px-5 py-3"
          />
          <button className="btn-primary" disabled={state === "sending"}>
            {state === "sending" ? "Turning on alerts" : "Turn on alerts"}
          </button>
        </form>
      )}
      {state === "error" && <p className="mt-2 text-sm text-tred">{msg}</p>}
    </section>
  );
}

// --- mileage -----------------------------------------------------------------

function Mileage({ driver, input }: { driver: string; input: PlanInput }) {
  const [rows, setRows] = useState<{ week: string; odometer: number }[]>([]);
  useEffect(() => {
    carplan.mileage(driver).then(setRows).catch(() => setRows([]));
  }, [driver]);
  if (rows.length < 2) return null;
  const months = rows.filter((r, i) => i === 0 || new Date(r.week).getMonth() !== new Date(rows[i - 1].week).getMonth());
  const lo = Math.min(...rows.map((r) => r.odometer));
  const hi = Math.max(...rows.map((r) => r.odometer));
  const step = [1000, 2000, 5000, 10000].find((n) => (hi - lo) / n <= 5) ?? 20000;
  const yTicks: number[] = [];
  for (let n = Math.floor(lo / step) * step; n < hi + step; n += step) yTicks.push(n);
  return (
    <section className="mt-12">
      <h2 className="text-2xl font-bold tracking-tight">Your driving this year</h2>
      <p className="mt-1 text-tgray">
        About {input.miles_per_year.toLocaleString()} miles a year, from your odometer history.
      </p>
      <div className="mt-4 h-56">
        <ResponsiveContainer>
          <LineChart data={rows} margin={{ left: 8, right: 8 }}>
            <XAxis
              dataKey="week"
              ticks={months.map((r) => r.week)}
              tickFormatter={(t) => new Date(t).toLocaleDateString("en-US", { month: "short" })}
              fontSize={12}
              minTickGap={8}
            />
            <YAxis
              fontSize={12}
              domain={[yTicks[0], yTicks[yTicks.length - 1]]}
              ticks={yTicks}
              tickFormatter={(n) => `${n / 1000}k`}
              width={40}
            />
            <Tooltip
              labelFormatter={(t) => new Date(t).toLocaleDateString()}
              formatter={(n: number) => [`${Math.round(n).toLocaleString()} mi`, "Odometer"]}
            />
            <Line type="monotone" dataKey="odometer" stroke="#eb0a1e" strokeWidth={2.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

// --- page ------------------------------------------------------------------

function PlanSkeleton() {
  const bar = "animate-pulse rounded bg-tsurface";
  return (
    <div aria-busy="true">
      <p className="mt-6 text-sm text-tgray" role="status">
        Comparing your options…
      </p>
      <section className="tcard mt-4 space-y-4 p-6 sm:p-8">
        <div className={`h-9 w-3/4 ${bar}`} />
        <div className={`h-4 w-4/5 ${bar}`} />
        <div className={`h-4 w-3/5 ${bar}`} />
        <div className={`h-11 w-56 rounded-full ${bar}`} />
      </section>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-36 rounded-[3px] border border-tline p-5">
            <div className={`h-8 w-1/2 ${bar}`} />
          </div>
        ))}
      </div>
      <div className="mt-12 grid gap-5 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-48 rounded-[3px] border border-tline p-5">
            <div className={`h-5 w-2/3 ${bar}`} />
            <div className={`mt-5 h-8 w-1/3 ${bar}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanPage() {
  const router = useRouter();
  const params = useSearchParams();
  const driver = params.get("driver");
  const [input, setInput] = useState<PlanInput | null>(null);
  const [value, setValue] = useState<number | null>(null);
  const [miles, setMiles] = useState<number | null>(null);
  const [data, setData] = useState<PlanResponse | null>(null);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const explainedFor = useRef<string | null>(null); // last explanation requested
  const shownFor = useRef<string | null>(null); // explanation currently on screen

  // Load the starting input: a sample driver, or what the customer entered on /start.
  useEffect(() => {
    setError(null);
    if (driver) {
      carplan.driver(driver).then(setInput).catch((e) => setError(e.message));
    } else {
      try {
        const saved = sessionStorage.getItem(INPUT_KEY);
        if (saved) setInput(JSON.parse(saved));
        else setError("Add your car first.");
      } catch {
        setError("Add your car first.");
      }
    }
  }, [driver]);

  const effective = useMemo<PlanInput | null>(
    () => (input ? { ...input, miles_per_year: miles ?? input.miles_per_year, market_value: value } : null),
    [input, miles, value],
  );
  const debounced = useDebounced(effective, 200);

  useEffect(() => {
    if (!debounced) return;
    let live = true;
    setLoading(true);
    carplan
      .plan(debounced)
      .then((d) => {
        if (!live) return;
        setData(d);
        if (value === null) setValue(d.plan.situation.market_value);
        if (miles === null) setMiles(d.input.miles_per_year);
      })
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // Gemini takes a few seconds, so re-explain once the sliders settle, and only for meaningful changes.
  // The previous explanation stays on screen (dimmed) unless the recommendation itself changed.
  const recommended = data?.plan.recommended;
  const explainInput = useDebounced(effective, 900);
  const [updating, setUpdating] = useState(false);
  useEffect(() => {
    if (!explainInput || !recommended || explainInput.market_value === null) return;
    const key = `${recommended}|${Math.round((explainInput.market_value ?? 0) / 250)}|${Math.round(explainInput.miles_per_year / 500)}`;
    if (explainedFor.current === key) {
      if (shownFor.current === key) setUpdating(false); // small nudge: current text still accurate
      return;
    }
    const changedPick = !explainedFor.current?.startsWith(`${recommended}|`);
    explainedFor.current = key;
    if (changedPick) setExplanation(null);
    setUpdating(true);
    carplan
      .explain(explainInput)
      .then((e) => {
        if (explainedFor.current !== key) return;
        shownFor.current = key;
        setExplanation(e);
        setUpdating(false);
      })
      .catch(() => explainedFor.current === key && setUpdating(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommended, explainInput]);
  // Sliding again marks the current text as stale right away.
  useEffect(() => {
    if (explanation && effective !== explainInput) setUpdating(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effective]);

  if (error) {
    return (
      <div className="pt-16">
        <p className="text-lg">{error}</p>
        <Link href="/" className="btn-primary mt-6">
          Start over
        </Link>
      </div>
    );
  }
  if (!data || !input || value === null || miles === null) {
    return <PlanSkeleton />;
  }

  const years = data.plan.horizon_months / 12;
  const options = [...data.plan.options].sort((a, b) => (a.id === data.plan.recommended ? -1 : b.id === data.plan.recommended ? 1 : a.total_cost - b.total_cost));
  const gap = data.plan.recommendations.find((r) => r.product === "gap" && r.priority === "high");
  const others = data.plan.recommendations.filter((r) => r !== gap);

  return (
    <div className={loading ? "opacity-90 transition-opacity" : ""}>
      <div className="mt-6 flex gap-5 text-sm text-tgray">
        <button
          type="button"
          className="underline"
          onClick={() => {
            try {
              sessionStorage.setItem(INPUT_KEY, JSON.stringify({ ...input, miles_per_year: miles, market_value: null }));
            } catch {}
            router.push(`/start?path=${input.path}&edit=1`);
          }}
        >
          Edit your details
        </button>
        <Link href="/" className="underline">
          Start over
        </Link>
      </div>
      <Answer input={input} data={data} explanation={explanation} gap={gap} updating={updating && !!explanation} />
      <Adjusters data={data} value={value} setValue={setValue} miles={miles} setMiles={setMiles} />
      {input.path === "other" && data.plan.toyota_equivalent && <Compare data={data} />}

      <section id="options" className="mt-12 scroll-mt-20">
        <h2 className="text-2xl font-bold tracking-tight">Every option, side by side</h2>
        <p className="mt-1 text-tgray">
          The all-in cost per month adds up payments, gas, upkeep, insurance and fees for {years} years. Then it
          subtracts what the car is still worth to you at the end.
        </p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {options.map((o) => (
            <OptionCard key={o.id} o={o} best={o.id === data.plan.recommended} years={years} />
          ))}
        </div>
      </section>

      <Products recs={others} disclosure={data.plan.disclosure} />
      {driver && <Mileage driver={driver} input={data.input} />}
      <RecallAlerts input={input} />

      <details className="mt-12 text-sm">
        <summary className="cursor-pointer font-semibold">How we calculated this</summary>
        <div className="mt-3 space-y-2 text-tgray">
          <Assumptions data={data} />
        </div>
      </details>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PlanSkeleton />}>
      <PlanPage />
    </Suspense>
  );
}
