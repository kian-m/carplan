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

export type Status = Record<"nessie" | "serpapi" | "gemini" | "tiger" | "snowflake" | "nhtsa" | "fueleconomy", boolean>;

export type FuelVehicle = {
  id: string;
  year: number;
  make: string;
  model: string;
  base_model: string | null;
  vehicle_class: string | null;
  drive: string | null;
  transmission: string | null;
  powertrain: string | null; // "Hybrid" | "Plug-in Hybrid" | "EV" | "Diesel" | null (gas)
  fuel_type: string | null;
  mpg_city: number | null;
  mpg_highway: number | null;
  mpg_combined: number | null;
  fuel_cost_annual: number | null; // EPA estimate at 15k miles/yr
  five_year_savings_vs_average: number | null;
  co2_grams_per_mile: number | null;
  ev_range_miles: number | null;
  other_models?: string[];
  variants?: { id: string; label: string }[];
};

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

  fuel: {
    lookup: (year: number, make: string, model: string) =>
      request<FuelVehicle | null>(`/fuel/lookup?${new URLSearchParams({ year: String(year), make, model })}`),
    models: (year: number, make: string) =>
      request<string[]>(`/fuel/models?${new URLSearchParams({ year: String(year), make })}`),
    vehicle: (id: string) => request<FuelVehicle>(`/fuel/vehicle/${id}`),
  },

  snowflake: {
    complete: (prompt: string) => post<{ text: string }>("/snowflake/complete", { prompt }),
  },
};
