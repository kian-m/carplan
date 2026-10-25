// Types and calls for the CarPlan API (backend/app/routers/carplan.py).

export type Path = "toyota" | "other";

export type PlanInput = {
  path: Path;
  name?: string | null;
  vehicle: {
    vin?: string | null;
    year: number;
    make: string;
    model: string;
    trim?: string | null;
    odometer: number;
    msrp?: number | null;
  };
  contract: {
    kind: "lease" | "loan" | "owned";
    monthly_payment: number;
    term_months: number;
    months_elapsed: number;
    residual_value?: number | null;
    miles_allowed_per_year?: number | null;
    excess_mile_fee?: number;
    apr?: number | null;
    amount_financed?: number | null;
    lender?: string | null;
  };
  finances: { monthly_income: number; monthly_bills: number; checking_balance?: number; source?: string };
  miles_per_year: number;
  market_value?: number | null;
  flags?: ("college" | "military")[];
};

export type OptionId = "buy_out" | "keep" | "new_toyota" | "certified_used" | "go_flexible";

export type Option = {
  id: OptionId;
  title: string;
  vehicle_label: string;
  monthly_payment: number;
  true_monthly_cost: number;
  total_cost: number;
  breakdown: {
    payments: number;
    fuel: number;
    maintenance: number;
    insurance: number;
    fees: number;
    equity_credit: number;
    equity_at_end: number;
  };
  affordable: boolean;
  notes: string[];
  tfs_products: string[];
  loan_to_value: number | null;
};

export type TfsRecommendation = {
  product: string;
  name: string;
  category: string;
  reason: string;
  url: string;
  priority: "high" | "medium" | "low";
};

export type TfsProduct = { name: string; category: string; description: string; url: string };

export type Plan = {
  horizon_months: number;
  situation: {
    market_value: number;
    market_value_low: number;
    market_value_high: number;
    market_value_method: "listings" | "estimate" | "user";
    market_value_sources: { title: string; url: string }[];
    payoff: number;
    equity: number;
    months_remaining: number;
    projected_odometer_at_end: number | null;
    projected_excess_miles: number;
    projected_excess_fee: number;
    warranty_basic_months_left: number | null;
  };
  options: Option[];
  recommended: OptionId;
  recommendations: TfsRecommendation[];
  toyota_equivalent: string | null;
  next_step: { label: string; url: string };
  assumptions: Record<string, unknown>;
  disclosure: string;
};

export type PlanResponse = { input: PlanInput; plan: Plan; fuel: { current_annual: number; toyota_annual: number } };

export type Explanation = {
  headline: string;
  summary: string;
  reasons: string[];
  source: "gemini" | "template";
};

export type DriverSummary = { id: string; name: string; tagline: string; path: Path; vehicle: string };

export type ParsedContract = Partial<{
  kind: "lease" | "loan";
  lender: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  odometer_at_signing: number;
  msrp: number;
  monthly_payment: number;
  term_months: number;
  first_payment_date: string;
  residual_value: number;
  miles_allowed_per_year: number;
  excess_mile_fee: number;
  apr: number;
  amount_financed: number;
  plain_language: { term: string; meaning: string }[];
}>;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.detail ?? `Request failed (${res.status})`);
  return body as T;
}

const json = (data: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

export const carplan = {
  drivers: () => call<DriverSummary[]>("/drivers"),
  driver: (id: string) => call<PlanInput>(`/drivers/${id}`),
  mileage: (id: string) => call<{ week: string; odometer: number }[]>(`/drivers/${id}/mileage`),
  plan: (input: PlanInput) => call<PlanResponse>("/plan", json(input)),
  products: () => call<Record<string, TfsProduct>>("/tfs/products"),
  explain: (input: PlanInput) => call<Explanation>("/plan/explain", json(input)),
  decodeVin: (vin: string) =>
    call<{ year?: string; make?: string; model?: string; trim?: string; valid: boolean; error: string | null }>(
      `/vehicle/vin/${encodeURIComponent(vin)}`,
    ),
  parseContract: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return call<ParsedContract>("/contract/parse", { method: "POST", body: form });
  },
  subscribe: (body: { email: string; year: number; make: string; model: string; vin?: string | null }) =>
    call<{ subscribed: boolean; open_recalls: number; email_sent: boolean; email_error: string | null }>(
      "/alerts/subscribe",
      json(body),
    ),
};

export const usd = (n: number, digits = 0) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits });

// Where a customer-built PlanInput is handed from /start to /plan.
export const INPUT_KEY = "carplan:input";
