"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { carplan, type DriverSummary } from "@/lib/carplan";

function PathCard({ href, title, body, cta }: { href: string; title: string; body: string; cta: string }) {
  return (
    <Link href={href} className="tcard group flex flex-col gap-3 transition-shadow hover:shadow-lg">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-tgray">{body}</p>
      <span className="mt-auto pt-2 font-semibold text-tred group-hover:underline">{cta}</span>
    </Link>
  );
}

export default function Home() {
  const [drivers, setDrivers] = useState<DriverSummary[]>([]);

  useEffect(() => {
    carplan.drivers().then(setDrivers).catch(() => setDrivers([]));
  }, []);

  return (
    <div className="pt-10 sm:pt-16">
      <h1 className="max-w-xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
        What&rsquo;s your car&rsquo;s next move?
      </h1>
      <p className="mt-4 max-w-lg text-lg text-tgray">
        Add your car. We&rsquo;ll show every option side by side, based on what your car is worth today.
      </p>

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
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

      {drivers.length > 0 && (
        <section className="mt-14">
          <h2 className="text-lg font-semibold">Just looking? Try a sample driver</h2>
          <ul className="mt-4 divide-y divide-tline border-y border-tline">
            {drivers.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/plan?driver=${d.id}`}
                  className="flex items-center justify-between gap-4 py-4 hover:bg-tsurface sm:px-2"
                >
                  <span>
                    <span className="font-semibold">{d.name}</span>
                    <span className="block text-sm text-tgray">
                      {d.vehicle} · {d.tagline}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-tred">View plan</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
