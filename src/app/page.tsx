import type { Metadata } from "next";
import { LiveHome } from "@/components/marketing/LiveHome";
import { homepageServiceSchema, faqSchema, jsonLd } from "@/lib/seo/structured-data";

// Overrides the root layout's title for the homepage only; every other route
// keeps the layout default. `title.absolute` opts out of the layout's
// "%s | EnhancedOps.Ninja" template so the homepage title isn't doubled.
export const metadata: Metadata = {
  title: {
    absolute: "EnhancedOps.Ninja — Command Center for Multi-Location Operators",
  },
  description:
    "Spoke & Hub Command Center, the Ninja Operating System with survey readiness, and the Ninja Path — for multi-location operators.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <>
      {/* Service catalog — the three offers and the free Visibility Audit,
          worded as they appear on the page below. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(homepageServiceSchema) }}
      />
      {/* FAQPage — every question here is rendered visibly by <LiveHome/> in the
          FAQ section. Remove both together or neither. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(faqSchema) }}
      />
      <LiveHome />
    </>
  );
}
