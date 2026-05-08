
import type { NextConfig } from "next";

const allowedOrigins = [
  "localhost:3000",
  process.env.APP_HOSTNAME,
].filter(Boolean) as string[];

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "pdf-parse"],
  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },
};

export default nextConfig;
