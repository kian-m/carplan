// Typed helpers for the FastAPI backend. Requests go through the /api rewrite in next.config.ts.

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.detail ?? `${res.status} ${res.statusText}`);
  return body as T;
}

const post = <T>(path: string, data?: unknown) =>
  request<T>(path, { method: "POST", body: data === undefined ? undefined : JSON.stringify(data) });

export type Status = Record<"nessie" | "serpapi" | "gemini" | "tiger" | "snowflake" | "nhtsa", boolean>;

export type Vehicle = {
  vin: string;
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
  body?: string;
  drive?: string;
  fuel?: string;
  electrification?: string;
  cylinders?: string;
  displacement_l?: string;
  horsepower?: string;
  transmission?: string;
  doors?: string;
  plant_country?: string;
  valid: boolean;
  error: string | null;
  raw: Record<string, string>;
};
export type ChatMessage = { role: "user" | "model"; text: string };
export type SeriesPoint = { bucket: string; value: number };

export const api = {
  status: () => request<Status>("/status"),

  nessie: {
    customers: () => request<any[]>("/nessie/customers"),
    snapshot: (customerId: string) => request<any>(`/nessie/customers/${customerId}/snapshot`),
  },

  search: (q: string, engine = "google") =>
    request<any>(`/search?${new URLSearchParams({ q, engine })}`),

  ai: {
    generate: (prompt: string, system?: string) => post<{ text: string }>("/ai/generate", { prompt, system }),
    chat: (messages: ChatMessage[], system?: string) => post<{ text: string }>("/ai/chat", { messages, system }),
  },

  tiger: {
    init: () => post<{ ok: boolean }>("/tiger/init"),
    seedDemo: () => post<{ inserted: number }>("/tiger/seed-demo"),
    series: (entityId = "demo", metric = "value", bucket = "1 day") =>
      request<SeriesPoint[]>(`/tiger/series?${new URLSearchParams({ entity_id: entityId, metric, bucket })}`),
  },

  vehicle: {
    decodeVin: (vin: string) => request<Vehicle>(`/vehicle/vin/${encodeURIComponent(vin)}`),
    models: (make: string, year: number) =>
      request<string[]>(`/vehicle/models?${new URLSearchParams({ make, year: String(year) })}`),
    recalls: (make: string, model: string, year: number) =>
      request<any[]>(`/vehicle/recalls?${new URLSearchParams({ make, model, year: String(year) })}`),
    complaints: (make: string, model: string, year: number) =>
      request<any[]>(`/vehicle/complaints?${new URLSearchParams({ make, model, year: String(year) })}`),
  },

  snowflake: {
    complete: (prompt: string) => post<{ text: string }>("/snowflake/complete", { prompt }),
  },
};
