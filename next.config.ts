import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Route all /_next/static/ asset requests through the primary domain so
  // Vercel's ?dpl= deployment scoping works (crm.enhancedops.ninja secondary
  // domain doesn't properly resolve ?dpl= scoped assets)
  assetPrefix: process.env.NODE_ENV === 'production' ? 'https://enhancedops.ninja' : '',
  async rewrites() {
    return {
      // afterFiles lets Next.js serve /public static files first (logo, favicon, etc.),
      // then applies the host rewrite for actual CRM routes.
      // beforeFiles intercepted /logo-dark.png → /crm/logo-dark.png (404).
      afterFiles: [
        {
          source: "/((?!_next).*)",
          has: [{ type: "host", value: "crm.enhancedops.ninja" }],
          destination: "/crm/$1",
        },
      ],
    };
  },
};

export default nextConfig;
