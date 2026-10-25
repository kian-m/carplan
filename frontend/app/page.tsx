"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Car, Check, Dollar, Upload } from "@/app/icons";
import { carplan, usd, type DriverSummary, type PlanResponse } from "@/lib/carplan";

function PathCard({ href, title, body, cta }: { href: string; title: string; body: string; cta: string }) {
  return (
    <Link href={href} className="tcard group flex flex-col gap-3 p-6 transition-shadow hover:shadow-lg">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-tgray">{body}</p>
      <span className="btn-primary mt-auto self-start">{cta}</span>
    </Link>
  );
}

// A real plan for the first sample driver, shrunk down: shows what CarPlan gives you before you start.
function Preview({ driver }: { driver: DriverSummary }) {
  const [data, setData] = useState<PlanResponse | null>(null);
  useEffect(() => {
    carplan
      .driver(driver.id)
      .then((input) => carplan.plan(input))
      .then(setData)
      .catch(() => setData(null));
  }, [driver.id]);

  const options = data ? [...data.plan.options].sort((a, b) => a.true_monthly_cost - b.true_monthly_cost) : [];
  const max = Math.max(...options.map((o) => o.true_monthly_cost), 1);
  const best = data?.plan.recommended;

  return (
    <Link
      href={`/plan?driver=${driver.id}`}
      className="tcard block p-5 transition-shadow hover:shadow-lg"
      aria-label={`See ${driver.name}'s plan`}
    >
      <p className="text-xs text-tgray">
        {driver.name.split(" ")[0]}&rsquo;s {driver.vehicle} · {driver.tagline}
      </p>
      <p className="mt-1 text-xl font-bold">{data ? data.plan.options.find((o) => o.id === best)?.title : "Comparing options…"}</p>
      <div className="mt-4 space-y-2.5">
        {(options.length ? options : [null, null, null, null]).map((o, i) => (
          <div key={o?.id ?? i} className="grid grid-cols-[7.5rem_1fr_3.5rem] items-center gap-2 text-xs">
            <span className={o?.id === best ? "font-semibold" : "text-tgray"}>{o?.title ?? ""}</span>
            <div className="h-4">
              {o ? (
                <div
                  className={`bar h-4 rounded-[2px] ${o.id === best ? "bg-tred" : "bg-[#b8b8b8]"}`}
                  style={{ width: `${(o.true_monthly_cost / max) * 100}%` }}
                />
              ) : (
                <div className="h-4 w-3/4 animate-pulse rounded-[2px] bg-tsurface" />
              )}
            </div>
            <span className={`text-right tabular-nums ${o?.id === best ? "font-bold" : ""}`}>{o ? usd(o.true_monthly_cost) : ""}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-tgray">All-in cost a month, lowest first</p>
    </Link>
  );
}

const STEPS = [
  { Icon: Upload, title: "Add your car", body: "Snap your contract, enter your VIN, or type a few details." },
  { Icon: Dollar, title: "We price it live", body: "Real listings near you, EPA fuel costs, and what you still owe." },
  { Icon: Check, title: "See your best move", body: "Every option side by side, with one clear answer." },
];

export default function Home() {
  const [drivers, setDrivers] = useState<DriverSummary[]>([]);

  useEffect(() => {
    carplan.drivers().then(setDrivers).catch(() => setDrivers([]));
  }, []);

  return (
    <div className="pt-10 sm:pt-16">
      <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">What&rsquo;s your car&rsquo;s next move?</h1>
          <p className="mt-5 max-w-lg text-lg text-tgray">
            Add your car. We&rsquo;ll show every option side by side, based on what your car is worth today.
          </p>
        </div>
        {drivers[0] && <Preview driver={drivers[0]} />}
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2">
        <PathCard
          href="/start?path=toyota"
          title="I drive a Toyota"
          body="Lease ending or paying off a loan? See if you should keep it, buy it or get something new."
          cta="Plan my next move"
        />
        <PathCard
          href="/start?path=other"
          title="I drive another brand"
          body="See what your car really costs to keep. Then compare it with a similar Toyota over five years."
          cta="Compare my car"
        />
      </div>

      <section className="mt-16" aria-label="How it works">
        <ol className="grid gap-6 sm:grid-cols-3">
          {STEPS.map(({ Icon, title, body }, i) => (
            <li key={title} className="flex gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#fdecee] text-tred">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold">
                  {i + 1}. {title}
                </p>
                <p className="mt-1 text-sm text-tgray">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {drivers.length > 0 && (
        <section className="mt-16">
          <h2 className="text-2xl font-bold tracking-tight">Just looking? Try a sample driver</h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-3">
            {drivers.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/plan?driver=${d.id}`}
                  className="group flex h-full flex-col rounded-[3px] border border-tline p-5 transition-colors hover:border-black"
                >
                  <Car className="h-7 w-7 text-tred" />
                  <span className="mt-3 font-semibold">{d.name}</span>
                  <span className="text-sm text-tgray">{d.vehicle}</span>
                  <span className="mt-3 self-start rounded-full bg-tsurface px-3 py-1 text-xs">{d.tagline}</span>
                  <span className="mt-auto pt-4 text-sm font-semibold text-tred group-hover:underline">View plan</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
