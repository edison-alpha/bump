import type { NextConfig } from "next";

/** bump-backend, where the browser's same-origin /api/* calls are proxied to (see lib/api/client.ts). */
const API_ORIGIN = (process.env.BUMP_API_ORIGIN ?? "https://api.paymom3nts.xyz").replace(/\/$/, "");

const config: NextConfig = {
  reactStrictMode: true,
  // The floating dev badge sits on top of the tab bar; keep the console clean while designing.
  devIndicators: false,
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.20.10.*"],
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` }];
  },
};

export default config;
