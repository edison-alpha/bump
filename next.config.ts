import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // The floating dev badge sits on top of the tab bar; keep the console clean while designing.
  devIndicators: false,
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.20.10.*"],
};

export default config;
