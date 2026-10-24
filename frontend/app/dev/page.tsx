"use client";

// Integration dev console: confirms each API key works and shows how to call it.
// Replace this page with your real app once you've picked an idea.

import { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, type SeriesPoint, type Status } from "@/lib/api";

function Card({ title, ok, children }: { title: string; ok?: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        {ok !== undefined && (
          <span className={`rounded-full px-2 py-0.5 text-xs ${ok ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-500"}`}>
            {ok ? "configured" : "no key"}
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

function useAction<T>() {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const run = async (fn: () => Promise<T>) => {
    setLoading(true);
    setError(null);
    try {
      setData(await fn());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  return { data, error, loading, run };
}

const btn = "rounded-lg bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50";
const input = "w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm";

function Output({ value, error }: { value: unknown; error: string | null }) {
  if (error) return <p className="mt-3 text-sm text-red-600">{error}</p>;
  if (value == null) return null;
  return (
    <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-zinc-100 p-3 text-xs">
      {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default function Home() {
  const [status, setStatus] = useState<Status | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("Give me 3 hackathon project ideas in one line each.");
  const [query, setQuery] = useState("best tacos near UT Austin");
  const [vin, setVin] = useState("4T1B11HK5JU080001");

  const nessie = useAction<unknown>();
  const serp = useAction<unknown>();
  const gemini = useAction<string>();
  const tiger = useAction<SeriesPoint[]>();
  const vehicle = useAction<unknown>();

  useEffect(() => {
    api.status().then(setStatus).catch((e) => setStatusError(e.message));
  }, []);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold">HackTX 2026 — integration console</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Add keys to <code>backend/.env</code>, restart the backend, and test each integration here.
      </p>
      {statusError && <p className="mt-3 text-sm text-red-600">Backend unreachable: {statusError}</p>}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card title="Gemini" ok={status?.gemini}>
          <textarea className={input} rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <button className={`${btn} mt-2`} disabled={gemini.loading} onClick={() => gemini.run(async () => (await api.ai.generate(prompt)).text)}>
            Generate
          </button>
          <Output value={gemini.data} error={gemini.error} />
        </Card>

        <Card title="SerpApi" ok={status?.serpapi}>
          <input className={input} value={query} onChange={(e) => setQuery(e.target.value)} />
          <button
            className={`${btn} mt-2`}
            disabled={serp.loading}
            onClick={() => serp.run(async () => (await api.search(query)).organic_results?.slice(0, 5).map((r: any) => ({ title: r.title, link: r.link })))}
          >
            Search
          </button>
          <Output value={serp.data} error={serp.error} />
        </Card>

        <Card title="NHTSA vehicle lookup" ok={status?.nhtsa}>
          <input className={input} value={vin} onChange={(e) => setVin(e.target.value)} placeholder="17-character VIN" />
          <button
            className={`${btn} mt-2`}
            disabled={vehicle.loading}
            onClick={() =>
              vehicle.run(async () => {
                const { raw, ...v } = await api.vehicle.decodeVin(vin);
                const recalls = v.make && v.model && v.year ? await api.vehicle.recalls(v.make, v.model, Number(v.year)) : [];
                return { ...v, open_recalls: recalls.length };
              })
            }
          >
            Decode VIN
          </button>
          <Output value={vehicle.data} error={vehicle.error} />
        </Card>

        <Card title="Capital One Nessie" ok={status?.nessie}>
          <button className={btn} disabled={nessie.loading} onClick={() => nessie.run(() => api.nessie.customers())}>
            List customers
          </button>
          <Output value={nessie.data} error={nessie.error} />
        </Card>

        <Card title="Tiger Data" ok={status?.tiger}>
          <div className="flex gap-2">
            <button
              className={btn}
              disabled={tiger.loading}
              onClick={() => tiger.run(async () => (await api.tiger.init(), await api.tiger.seedDemo(), api.tiger.series()))}
            >
              Init + seed demo
            </button>
            <button className={btn} disabled={tiger.loading} onClick={() => tiger.run(() => api.tiger.series())}>
              Load series
            </button>
          </div>
          {tiger.error && <Output value={null} error={tiger.error} />}
          {tiger.data && (
            <div className="mt-3 h-48">
              <ResponsiveContainer>
                <LineChart data={[...tiger.data].reverse()}>
                  <XAxis dataKey="bucket" tickFormatter={(t) => new Date(t).toLocaleDateString()} fontSize={11} />
                  <YAxis fontSize={11} domain={["auto", "auto"]} />
                  <Tooltip labelFormatter={(t) => new Date(t).toLocaleDateString()} />
                  <Line type="monotone" dataKey="value" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
