// Proxies /api/* to the FastAPI backend. BACKEND_URL is read per request, so one
// build works locally and on Cloud Run without baking the backend URL in.

import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

async function proxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const backend = process.env.BACKEND_URL ?? "http://localhost:8000";
  const url = `${backend}/api/${path.join("/")}${req.nextUrl.search}`;

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const res = await fetch(url, {
    method: req.method,
    headers: { "Content-Type": req.headers.get("content-type") ?? "application/json" },
    body: hasBody ? await req.text() : undefined,
    cache: "no-store",
  });

  return new Response(res.body, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
  });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
