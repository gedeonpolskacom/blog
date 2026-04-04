import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16 dev security: allow local alternate origins used in browser/IDE preview.
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
  ],
};

export default nextConfig;
