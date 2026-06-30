import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Route all /_next/static/ asset requests through the primary domain so
  // Vercel's ?dpl= deployment scoping works (crm.enhancedops.ninja secondary
  // domain doesn't properly resolve ?dpl= scoped assets)
  assetPrefix: process.env.NODE_ENV === 'production' ? 'https://enhancedops.ninja' : '',
  async rewrites() {
    return {
      beforeFiles: [
        {
          // Rewrite CRM subdomain to /crm/* routes.
          // Excludes: _next assets, and any path ending with a static file extension
          // so that /public files (logo-dark.png etc.) are served directly.
          source: "/((?!_next)(?!.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot|pdf|txt)(?:\\?.*)?$).*)",
          has: [{ type: "host", value: "crm.enhancedops.ninja" }],
          destination: "/crm/$1",
        },
      ],
    };
  },
};

export default nextConfig;
