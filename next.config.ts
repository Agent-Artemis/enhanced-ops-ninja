import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Route all /_next/static/ asset requests through the primary domain so
  // Vercel's ?dpl= deployment scoping works (crm.enhancedops.ninja secondary
  // domain doesn't properly resolve ?dpl= scoped assets)
  assetPrefix: process.env.NODE_ENV === 'production' ? 'https://enhancedops.ninja' : '',
  // ---------------------------------------------------------------------
  // BOOKING LINKS — the only place the cal.com username appears.
  //
  // Every booking link on our sites and in our emails points at a relative
  // /book path, never at cal.com directly. Two reasons:
  //   1. Masking. A healthcare prospect should see enhancedops.ninja in the
  //      address bar, not whatever the cal.com username happens to be.
  //   2. Renames. This is the second username change in a month, so assume a
  //      third. When it happens this block is the whole edit.
  //
  // permanent: false is deliberate — a 308 gets cached hard by browsers and we
  // could never take it back. Temporary keeps the next rename cheap.
  //
  // The 15-min event type was deleted deliberately by Jeff on 2026-09-02 and is
  // not coming back, so there is no /book/15. The five landing pages that
  // offered it now offer the 30-minute call, copy included.
  // ---------------------------------------------------------------------
  async redirects() {
    const CAL = "https://cal.com/businessintelligenceninja";
    return [
      { source: "/book", destination: `${CAL}/30-min`, permanent: false },
      { source: "/book/briefing", destination: `${CAL}/secret-mission-briefing`, permanent: false },
      { source: "/book/45", destination: `${CAL}/45-min`, permanent: false },
      { source: "/book/hour", destination: `${CAL}/1-hour`, permanent: false },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          // Rewrite CRM subdomain to /crm/* routes.
          // Excludes: _next assets, /api routes (so CRM API calls like
          // /api/crm/reports resolve to the real apex route instead of a
          // nonexistent /crm/api/* path — was causing a 404 in Reports), and
          // any path ending with a static file extension so that /public files
          // (logo-dark.png etc.) are served directly.
          source: "/((?!_next)(?!api/)(?!.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot|pdf|txt)(?:\\?.*)?$).*)",
          has: [{ type: "host", value: "crm.enhancedops.ninja" }],
          destination: "/crm/$1",
        },
      ],
    };
  },
};

export default nextConfig;
