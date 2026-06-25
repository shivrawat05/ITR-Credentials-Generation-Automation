import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";
import { resolve } from "node:path";

loadEnvConfig(resolve(process.cwd(), ".."));

const nextConfig: NextConfig = {
  transpilePackages: ["@itr/shared"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/:path*` : "http://localhost:4000/:path*",
      },
    ];
  },
};

export default nextConfig;
