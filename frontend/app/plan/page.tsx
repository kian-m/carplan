"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Bell, Car, Check, Dollar, Gauge, Shield, Tag, Umbrella, Wrench } from "@/app/icons";
import {
  carplan,
  INPUT_KEY,
  packPlan,
  unpackPlan,
  usd,
  type Explanation,
  type Option,
  type PlanInput,
  type PlanResponse,
  type TfsProduct,
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

// Parts of the all-in cost, in the order and colors used by every cost bar.
const PARTS = [
  { key: "payments", label: "Payments", color: "#000000" },
  { key: "fuel", label: "Gas", color: "#eb0a1e" },
  { key: "maintenance", label: "Upkeep", color: "#58595b" },
  { key: "insurance", label: "Insurance", color: "#b8b8b8" },
  { key: "fees", label: "Fees", color: "#f29aa2" },
] as const;

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
  const runnerUp = data.plan.options.filter((o) => o.id !== best.id).sort((a, b) => a.total_cost - b.total_cost)[0];
  const saving = runnerUp ? runnerUp.total_cost - best.total_cost : 0;
  const years = data.plan.horizon_months / 12;
  const v = input.vehicle;
  const cta = data.plan.next_step;

  return (
    <section className="tcard mt-4 overflow-hidden !p-0">
      <div className="grid lg:grid-cols-[1fr_300px]">
        <div className="p-6 sm:p-8">
          <p className="flex items-center gap-2 text-sm text-tgray">
            <Car className="h-5 w-5 shrink-0" />
            <span>
              {input.name ? `${input.name}'s ` : "Your "}
              {v.year} {v.make} {v.model}
              {v.trim ? ` ${v.trim}` : ""} · {situationLine(input, data.plan.situation.months_remaining)}
            </span>
          </p>

          {explanation ? (
            <div className={updating ? "opacity-50 transition-opacity" : "transition-opacity"} aria-busy={updating}>
              {updating && <p className="mt-3 text-xs font-semibold text-tred">Updating for your changes…</p>}
              <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-[40px]">{explanation.headline}</h1>
              <p className="mt-3 text-lg text-tgray">{explanation.summary}</p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-3">
                {explanation.reasons.map((r) => (
                  <li key={r} className="flex gap-2.5 rounded-[3px] bg-tsurface p-3.5 text-sm leading-snug">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-tred" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-[40px]">{best.title}</h1>
              <div className="mt-4 space-y-3" aria-label="Writing your explanation">
                <div className="h-4 w-4/5 animate-pulse rounded bg-tsurface" />
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-20 animate-pulse rounded-[3px] bg-tsurface" />
                  ))}
                </div>
              </div>
            </>
          )}

          {gap && (
            <div className="mt-6 flex gap-3 rounded-[3px] border border-tred/30 bg-[#fdecee] p-4">
              <Shield className="h-6 w-6 shrink-0 text-tred" />
              <div>
                <p className="font-semibold">Protect yourself with GAP</p>
                <p className="mt-1 text-sm">{gap.reason}</p>
                <a href={gap.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-tred underline">
                  Learn about GAP
                </a>
              </div>
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
        </div>

        <aside className="flex flex-col justify-center gap-5 bg-black p-6 text-white sm:p-8">
          <div>
            <p className="text-sm text-white/70">All-in cost</p>
            <p className="mt-1 text-5xl font-bold tabular-nums tracking-tight">
              <Live value={Math.round(best.true_monthly_cost)}>{usd(best.true_monthly_cost)}</Live>
            </p>
            <p className="text-sm text-white/70">a month, everything included</p>
          </div>
          {saving > 0 && (
            <div className="border-t border-white/20 pt-5">
              <p className="text-3xl font-bold tabular-nums text-[#ff4d5e]">
                <Live value={Math.round(saving)}>{usd(saving)}</Live>
              </p>
              <p className="text-sm text-white/70">saved over {years} years vs. your next best choice:</p>
              <p className="text-sm font-semibold">{runnerUp.title}</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

// --- where you stand -------------------------------------------------------

function Standing({ data }: { data: PlanResponse }) {
  const s = data.plan.situation;
  const kind = data.input.contract.kind;
  if (kind === "owned") return null;
  const lease = kind === "lease";
  const worth = Math.max(0, s.equity + s.payoff);
  const max = Math.max(worth, s.payoff, 1);
  const rows = [
    { label: lease ? "Worth at lease end" : "What it's worth", value: worth, color: "bg-black" },
    { label: lease ? "Your buyout price at lease end" : "What you owe today", value: s.payoff, color: "bg-[#b8b8b8]" },
  ];
  return (
    <div className="rounded-[3px] border border-tline p-5 lg:col-span-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Where you stand</h2>
        <Live value={Math.round(s.equity)} className={s.equity >= 0 ? "font-semibold text-tgreen" : "font-semibold text-tred"}>
          {s.equity >= 0 ? `${usd(s.equity)} in equity` : `${usd(-s.equity)} more than it's worth`}
        </Live>
      </div>
      <div className="mt-4 space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="grid items-center gap-1 sm:grid-cols-[13rem_1fr] sm:gap-3">
            <span className="text-sm text-tgray">
              {r.label}: <span className="font-semibold text-black tabular-nums">{usd(r.value)}</span>
            </span>
            <div className="h-3 rounded-full bg-tsurface">
              <div className={`bar h-3 rounded-full ${r.color} transition-[width] duration-500`} style={{ width: `${(r.value / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-tgray">
        {s.equity >= 0
          ? "If you switch cars, that money goes toward your next one."
          : "If you switch cars, this amount gets added to your new loan."}
      </p>
    </div>
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
  const c = data.input.contract;
  const allowed = Math.round(((c.miles_allowed_per_year ?? 12000) * c.term_months) / 12);
  const alreadyOver = Math.max(0, data.input.vehicle.odometer - allowed);

  return (
    <section className="mt-6 grid gap-5 lg:grid-cols-2" aria-label="Adjust your numbers">
      <div className="rounded-[3px] border border-tline p-5">
        <div className="flex items-center gap-2 text-sm text-tgray">
          <Tag className="h-5 w-5" />
          <label htmlFor="value">What your car is worth today</label>
        </div>
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
        <div className="flex justify-between text-xs text-tgray tabular-nums">
          <span>{usd(min)}</span>
          <span>{usd(max)}</span>
        </div>
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
        <div className="flex items-center gap-2 text-sm text-tgray">
          <Gauge className="h-5 w-5" />
          <label htmlFor="miles">Miles you drive a year</label>
        </div>
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
        <div className="flex justify-between text-xs text-tgray tabular-nums">
          <span>3,000</span>
          <span>30,000</span>
        </div>
        {lease && s.projected_excess_miles > 0 ? (
          <p className="mt-2 flex gap-1.5 text-xs font-semibold text-tred">
            <Alert className="h-4 w-4 shrink-0" />
            <span>
              {alreadyOver > 0 && `You’re already ${alreadyOver.toLocaleString()} miles over your ${allowed.toLocaleString()}-mile limit. `}
              At this rate you’ll go {s.projected_excess_miles.toLocaleString()} miles over your lease limit. That’s{" "}
              {usd(s.projected_excess_fee)} in fees if you return it
              {s.equity > 0 ? ". Switching cars avoids them, because your equity pays off the lease." : "."}
            </span>
          </p>
        ) : (
          <p className="mt-2 text-xs text-tgray">Based on what you told us. Change it to see if your best move changes.</p>
        )}
      </div>

      <Standing data={data} />
    </section>
  );
}

// --- other brands: your car vs. the Toyota -----------------------------------

function Compare({ data }: { data: PlanResponse }) {
  const v = data.input.vehicle;
  const target = data.plan.toyota_equivalent;
  const scale = data.input.miles_per_year / 15000;
  const rows: [string, string, string][] = [
    ["Gas a year", usd(data.fuel.current_annual * scale), usd(data.fuel.toyota_annual * scale)],
    ["ToyotaCare free service", "Not included", "2 years (new)"],
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
        Value loss: about {pct(a.depreciation_per_year as unknown as number)} a year for every brand, from iSeeCars&rsquo; finding that the
        average car loses 41.8% in 5 years. More if you drive over 12,000 miles a year (our estimate).
      </li>
      <li>
        New Toyota prices: Toyota&rsquo;s 2026 starting prices from toyota.com, before the delivery fee. Certified Used: the
        median of live listings for a {a.certified_used_age_years}-year-old model when we find at least 5, otherwise about{" "}
        {pct(a.certified_used_price_pct_of_msrp)} of the new price (our estimate). Your equity, or what you owe beyond your
        car&rsquo;s value, goes into the new loan.
      </li>
      <li>
        New lease: {a.new_lease_term_months} months, {a.new_lease_miles_per_year.toLocaleString()} miles a year, worth{" "}
        {pct(a.new_lease_residual_pct)} of its price at the end. These are example terms, not an offer.
      </li>
      <li>
        Lease end: a {usd(a.purchase_option_fee)} buyout fee (our estimate; check your contract) and a {usd(a.disposition_fee)} return
        fee, which TFS waives when you get a new or certified Toyota through TFS.
      </li>
      <li>Fits your budget: the payment plus insurance is at most {pct(a.max_car_budget_pct_of_income)} of your monthly income.</li>
      <li>Our math follows fixed rules. AI only writes the words you read.</li>
    </ul>
  );
}

// --- options -------------------------------------------------------------

function Ranking({ options, best }: { options: Option[]; best: string }) {
  const sorted = [...options].sort((a, b) => a.true_monthly_cost - b.true_monthly_cost);
  const max = Math.max(...sorted.map((o) => o.true_monthly_cost), 1);
  return (
    <div className="mt-6 space-y-3 rounded-[3px] bg-tsurface p-5" aria-label="All-in cost per month, lowest first">
      {sorted.map((o) => (
        <div key={o.id} className="grid grid-cols-[8rem_1fr_4.5rem] items-center gap-3 sm:grid-cols-[13rem_1fr_5rem]">
          <span className={`text-sm leading-tight ${o.id === best ? "font-semibold" : "text-tgray"}`}>{o.title}</span>
          <div className="h-6">
            <div
              className={`bar h-6 rounded-[3px] transition-[width] duration-500 ${o.id === best ? "bg-tred" : "bg-[#b8b8b8]"}`}
              style={{ width: `${Math.max(4, (o.true_monthly_cost / max) * 100)}%` }}
            />
          </div>
          <span className={`text-right text-sm tabular-nums ${o.id === best ? "font-bold" : ""}`}>{usd(o.true_monthly_cost)}</span>
        </div>
      ))}
    </div>
  );
}

function CostBar({ o, max }: { o: Option; max: number }) {
  const b = o.breakdown as unknown as Record<string, number>;
  return (
    <div className="mt-4">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-tsurface" style={{ width: `${Math.max(20, (o.total_cost / max) * 100)}%` }}>
        {PARTS.map((p) => {
          const gross = PARTS.reduce((t, q) => t + Math.max(0, b[q.key]), 0) || 1;
          const w = (Math.max(0, b[p.key]) / gross) * 100;
          return w > 0 ? <div key={p.key} title={p.label} className="h-full transition-[width] duration-500" style={{ width: `${w}%`, background: p.color }} /> : null;
        })}
      </div>
    </div>
  );
}

function OptionCard({ o, best, years, max }: { o: Option; best: boolean; years: number; max: number }) {
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
          ? "tcard relative flex flex-col ring-1 ring-tred"
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
      <CostBar o={o} max={max} />
      {!o.affordable && (
        <p className="mt-3 flex gap-1.5 text-sm font-semibold text-tred">
          <Alert className="h-4 w-4 shrink-0" />
          Above the 20% of income we recommend for car costs
        </p>
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

function productIcon(r: TfsRecommendation) {
  if (["vsa", "service_care", "toyotacare_plus"].includes(r.product)) return Wrench;
  if (r.category === "Protection") return Shield;
  if (r.category === "Rebates") return Tag;
  if (r.category === "Insurance") return Umbrella;
  if (r.product === "certified_used" || r.product === "turn_in_new") return Car;
  return Dollar;
}

function Products({ recs, disclosure }: { recs: TfsRecommendation[]; disclosure: string }) {
  if (!recs.length) return null;
  return (
    <section className="mt-14">
      <h2 className="text-2xl font-bold tracking-tight">Toyota Financial Services can help</h2>
      <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {recs.map((r) => {
          const Icon = productIcon(r);
          return (
            <li key={r.product} className="flex flex-col rounded-[3px] border border-tline p-5">
              <div className="flex items-start justify-between gap-2">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#fdecee] text-tred">
                  <Icon className="h-5 w-5" />
                </span>
                {r.priority === "high" && (
                  <span className="rounded-full bg-tred px-2 py-0.5 text-xs font-semibold text-white">Recommended</span>
                )}
              </div>
              <p className="mt-3 font-semibold">{r.name}</p>
              <p className="mt-1 flex-1 text-sm text-tgray">{r.reason}</p>
              <a href={r.url} target="_blank" rel="noreferrer" className="mt-3 text-sm font-semibold text-tred underline">
                Learn more
              </a>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-tgray">{disclosure}</p>
    </section>
  );
}

// Every TFS service, grouped like toyotafinancial.com, with the ones that fit this driver marked.
function Catalog({ plan }: { plan: PlanResponse["plan"] }) {
  const [products, setProducts] = useState<Record<string, TfsProduct>>({});
  useEffect(() => {
    carplan.products().then(setProducts).catch(() => setProducts({}));
  }, []);
  const picked = new Set([
    ...plan.recommendations.map((r) => r.product),
    ...(plan.options.find((o) => o.id === plan.recommended)?.tfs_products ?? []),
  ]);
  const groups: Record<string, [string, TfsProduct][]> = {};
  for (const [key, p] of Object.entries(products)) (groups[p.category] ??= []).push([key, p]);
  if (!Object.keys(groups).length) return null;
  return (
    <section className="mt-14" aria-labelledby="catalog">
      <h2 id="catalog" className="text-2xl font-bold tracking-tight">
        Everything Toyota Financial Services offers
      </h2>
      <p className="mt-1 text-tgray">
        <span className="font-semibold text-black">{[...picked].filter((k) => products[k]).length}</span> of{" "}
        {Object.keys(products).length} fit your situation. They&rsquo;re marked below.
      </p>
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(groups).map(([category, items]) => (
          <div key={category}>
            <h3 className="border-b-2 border-black pb-2 text-sm font-semibold">{category}</h3>
            <ul className="divide-y divide-tline">
              {items.map(([key, p]) => (
                <li key={key}>
                  <a href={p.url} target="_blank" rel="noreferrer" className="group flex items-start justify-between gap-3 py-3">
                    <span>
                      <span className="block text-sm font-semibold group-hover:underline">{p.name}</span>
                      <span className="block text-xs text-tgray">{p.description}</span>
                    </span>
                    {picked.has(key) && (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#fdecee] px-2 py-0.5 text-xs font-semibold text-tred">
                        <Check className="h-3 w-3" />
                        For you
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// --- recall alerts -----------------------------------------------------------

function RecallAlerts({ input, driver }: { input: PlanInput; driver: string | null }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const v = input.vehicle;
  const car = `${v.make} ${v.model}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    try {
      const plan_path = driver ? `/plan?driver=${driver}` : `/plan?p=${packPlan(input)}`;
      const r = await carplan.subscribe({ email, year: v.year, make: v.make, model: v.model, vin: v.vin, plan_path });
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
    <section className="mt-14 grid gap-5 rounded-[3px] bg-black p-6 text-white sm:p-8 lg:grid-cols-[1fr_1.2fr] lg:items-center">
      <div className="flex gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-tred">
          <Bell className="h-6 w-6" />
        </span>
        <div>
          <h2 className="text-xl font-semibold">Get free recall alerts for your {car}</h2>
          <p className="mt-1 text-sm text-white/70">We&rsquo;ll email you if there&rsquo;s a safety recall. Unsubscribe anytime.</p>
        </div>
      </div>
      <div>
        {state === "done" ? (
          <p className="font-semibold" role="status">
            Alerts are on. {msg}
          </p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
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
              className="min-w-0 flex-1 rounded-full border border-white/30 bg-white px-5 py-3 text-black"
            />
            <button className="btn-primary" disabled={state === "sending"}>
              {state === "sending" ? "Turning on alerts" : "Turn on alerts"}
            </button>
          </form>
        )}
        {state === "error" && <p className="mt-2 text-sm text-[#ff8a95]">{msg}</p>}
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
      <section className="tcard mt-4 grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_260px]">
        <div className="space-y-4">
          <div className={`h-9 w-3/4 ${bar}`} />
          <div className={`h-4 w-4/5 ${bar}`} />
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`h-20 ${bar}`} />
            ))}
          </div>
          <div className={`h-11 w-56 rounded-full ${bar}`} />
        </div>
        <div className={`h-48 ${bar}`} />
      </section>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-36 rounded-[3px] border border-tline p-5">
            <div className={`h-8 w-1/2 ${bar}`} />
          </div>
        ))}
      </div>
      <div className={`mt-12 h-40 ${bar}`} />
    </div>
  );
}

function PlanPage() {
  const router = useRouter();
  const params = useSearchParams();
  const driver = params.get("driver");
  const packed = params.get("p"); // a plan link from a recall email
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
    } else if (packed) {
      try {
        const restored = unpackPlan(packed);
        sessionStorage.setItem(INPUT_KEY, JSON.stringify(restored));
        setInput(restored);
      } catch {
        setError("That link didn't work. Add your car to see your plan.");
      }
    } else {
      try {
        const saved = sessionStorage.getItem(INPUT_KEY);
        if (saved) setInput(JSON.parse(saved));
        else setError("Add your car first.");
      } catch {
        setError("Add your car first.");
      }
    }
  }, [driver, packed]);

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
  const maxTotal = Math.max(...options.map((o) => o.total_cost), 1);
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
      {!input.finances.monthly_income && (
        <p className="mt-4 rounded-[3px] bg-tsurface p-3 text-sm">
          Welcome back. Your income isn&rsquo;t saved in your link, so this plan doesn&rsquo;t check your budget. Use{" "}
          <span className="font-semibold">Edit your details</span> to add it.
        </p>
      )}
      <Answer input={input} data={data} explanation={explanation} gap={gap} updating={updating && !!explanation} />
      <Adjusters data={data} value={value} setValue={setValue} miles={miles} setMiles={setMiles} />
      {input.path === "other" && data.plan.toyota_equivalent && <Compare data={data} />}

      <section id="options" className="mt-14 scroll-mt-20">
        <h2 className="text-2xl font-bold tracking-tight">Every option, side by side</h2>
        <p className="mt-1 text-tgray">
          All-in cost a month over {years} years: payments, gas, upkeep, insurance and fees, minus what the car is still worth at the end.
        </p>
        <Ranking options={options} best={data.plan.recommended} />
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-tgray">
          {PARTS.map((p) => (
            <span key={p.key} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
              {p.label}
            </span>
          ))}
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {options.map((o) => (
            <OptionCard key={o.id} o={o} best={o.id === data.plan.recommended} years={years} max={maxTotal} />
          ))}
        </div>
      </section>

      <Products recs={others} disclosure={data.plan.disclosure} />
      <Catalog plan={data.plan} />
      <RecallAlerts input={input} driver={driver} />

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
