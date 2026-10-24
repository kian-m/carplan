import type { NextConfig } from "next";

// /api/* is proxied to FastAPI at runtime by app/api/[...path]/route.ts (reads BACKEND_URL).
const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
