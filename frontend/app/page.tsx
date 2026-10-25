"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Car, Check, Dollar, Upload } from "@/app/icons";
import { carplan, type DriverSummary } from "@/lib/carplan";

function PathCard({ href, title, body, cta }: { href: string; title: string; body: string; cta: string }) {
  return (
    <Link href={href} className="tcard group flex flex-col gap-3 p-6 transition-shadow hover:shadow-lg">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-tgray">{body}</p>
      <span className="btn-primary mt-auto self-start">{cta}</span>
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
      <h1 className="max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">What&rsquo;s your car&rsquo;s next move?</h1>
      <p className="mt-5 max-w-lg text-lg text-tgray">
        Add your car. We&rsquo;ll show every option side by side, based on what your car is worth today.
      </p>

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
