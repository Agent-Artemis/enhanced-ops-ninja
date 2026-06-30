import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return {
      beforeFiles: [
        {
          // Exclude /_next/* (static assets, chunks, HMR) from the rewrite
          source: "/((?!_next).*)",
          has: [{ type: "host", value: "crm.enhancedops.ninja" }],
          destination: "/crm/$1",
        },
      ],
    };
  },
};

export default nextConfig;
