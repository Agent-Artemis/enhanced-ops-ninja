import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/:path*",
          has: [{ type: "host", value: "crm.enhancedops.ninja" }],
          destination: "/crm/:path*",
        },
      ],
    };
  },
};

export default nextConfig;
