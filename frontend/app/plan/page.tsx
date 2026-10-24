"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
}: {
  input: PlanInput;
  data: PlanResponse;
  explanation: Explanation | null;
  gap?: TfsRecommendation;
}) {
  const best = data.plan.options.find((o) => o.id === data.plan.recommended)!;
  const v = input.vehicle;
  // The button goes to the most relevant TFS page: the option's own product, else the top recommendation.
  const ctaUrl =
    data.plan.recommendations.find((r) => best.tfs_products.includes(r.product))?.url ??
    data.plan.recommendations.find((r) => r.priority === "high")?.url ??
    data.plan.recommendations[0]?.url ??
    "https://www.toyotafinancial.com/us/en.html";

  return (
    <section className="tcard mt-6 p-6 sm:p-8">
      <p className="text-sm text-tgray">
        {input.name ? `${input.name}'s ` : "Your "}
        {v.year} {v.make} {v.model}
        {v.trim ? ` ${v.trim}` : ""} · {situationLine(input, data.plan.situation.months_remaining)}
      </p>

      {explanation ? (
        <>
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
        </>
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
          <p className="font-semibold">Protect the gap: {gap.name}</p>
          <p className="mt-1 text-sm">{gap.reason}</p>
          <a href={gap.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-tred underline">
            Learn about GAP
          </a>
        </div>
      )}

      <div className="mt-7 flex flex-wrap gap-3">
        <a href={ctaUrl} target="_blank" rel="noreferrer" className="btn-primary">
          {explanation?.next_step ?? best.title}
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
            ? `Typical range ${usd(s.market_value_low)} to ${usd(s.market_value_high)}, from ${sources.length} listing sites near Austin. `
            : `Estimated from the original price, age and mileage. `}
          Know something we don&rsquo;t, like new tires or a dent? Slide to adjust.
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
            ? `At this pace you'll be ${s.projected_excess_miles.toLocaleString()} miles over your lease allowance (${usd(s.projected_excess_fee)} if you return it).`
            : "Based on your recent driving. Change it to see how your best move shifts."}
        </p>
      </div>

      <div className="rounded-[3px] bg-tsurface p-5 sm:col-span-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p>
            {lease ? "Your buyout price at lease end" : "What you owe today"}:{" "}
            <span className="font-semibold tabular-nums">{usd(s.payoff)}</span>
          </p>
          <p className={s.equity >= 0 ? "font-semibold text-tgreen" : "font-semibold text-tred"}>
            {s.equity >= 0
              ? `${usd(s.equity)} in equity`
              : `${usd(-s.equity)} more than it's worth`}
          </p>
        </div>
      </div>
    </section>
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
        {usd(o.monthly_payment)}
        <span className="text-base font-normal text-tgray">/mo</span>
      </p>
      <p className="mt-1 text-sm">
        True cost <span className="font-semibold tabular-nums">{usd(o.true_monthly_cost)}/mo</span> over {years} years
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
        ? `NHTSA lists ${r.open_recalls} recall${r.open_recalls === 1 ? "" : "s"} for your ${car} right now.`
        : `There are no open recalls for your ${car} right now.`;
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
        We&rsquo;ll email you if NHTSA issues a safety recall, plus a heads-up before your
        {input.contract.kind === "lease" ? " lease ends" : " next big decision"}. Unsubscribe anytime.
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
              tickFormatter={(t) => new Date(t).toLocaleDateString("en-US", { month: "short" })}
              fontSize={12}
              minTickGap={24}
            />
            <YAxis fontSize={12} domain={["auto", "auto"]} tickFormatter={(n) => `${Math.round(n / 1000)}k`} width={40} />
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

function PlanPage() {
  const params = useSearchParams();
  const driver = params.get("driver");
  const [input, setInput] = useState<PlanInput | null>(null);
  const [value, setValue] = useState<number | null>(null);
  const [miles, setMiles] = useState<number | null>(null);
  const [data, setData] = useState<PlanResponse | null>(null);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const explainedFor = useRef<string | null>(null);

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

  // Re-explain only when the recommendation itself changes (Gemini takes a few seconds).
  const recommended = data?.plan.recommended;
  const explainInput = useDebounced(effective, 700);
  useEffect(() => {
    if (!explainInput || !recommended) return;
    const key = `${recommended}`;
    if (explainedFor.current === key) return;
    explainedFor.current = key;
    setExplanation(null);
    carplan.explain(explainInput).then((e) => explainedFor.current === key && setExplanation(e)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommended, explainInput]);

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
    return <p className="pt-16 text-tgray">Comparing your options…</p>;
  }

  const years = data.plan.horizon_months / 12;
  const options = [...data.plan.options].sort((a, b) => (a.id === data.plan.recommended ? -1 : b.id === data.plan.recommended ? 1 : a.total_cost - b.total_cost));
  const gap = data.plan.recommendations.find((r) => r.product === "gap" && r.priority === "high");
  const others = data.plan.recommendations.filter((r) => r !== gap);

  return (
    <div className={loading ? "opacity-90 transition-opacity" : ""}>
      <Link href="/" className="mt-6 inline-block text-sm text-tgray underline">
        Start over
      </Link>
      <Answer input={input} data={data} explanation={explanation} gap={gap} />
      <Adjusters data={data} value={value} setValue={setValue} miles={miles} setMiles={setMiles} />

      <section id="options" className="mt-12 scroll-mt-20">
        <h2 className="text-2xl font-bold tracking-tight">Every option, side by side</h2>
        <p className="mt-1 text-tgray">
          True cost includes payments, fuel, maintenance, insurance and fees, minus what you&rsquo;d own at the end of{" "}
          {years} years.
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
          <p>
            Fuel: EPA estimates of {usd(data.fuel.current_annual)} a year for your car and {usd(data.fuel.toyota_annual)} for
            the {data.plan.toyota_equivalent}, scaled to {data.input.miles_per_year.toLocaleString()} miles.
          </p>
          <p>Car value: {data.plan.situation.market_value_method === "listings" ? "median of current listings near Austin" : data.plan.situation.market_value_method === "user" ? "your adjustment" : "estimated from original price, age and mileage"}.</p>
          <p>
            Rates and assumptions:{" "}
            {Object.entries(data.plan.assumptions)
              .filter(([, v]) => typeof v === "number" || typeof v === "string")
              .map(([k, v]) => `${k.replaceAll("_", " ")}: ${v}`)
              .join(" · ")}
          </p>
          <p>The math is deterministic; AI only writes the explanation.</p>
        </div>
      </details>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="pt-16 text-tgray">Loading…</p>}>
      <PlanPage />
    </Suspense>
  );
}
