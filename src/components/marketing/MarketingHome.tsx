"use client";

import { useRouter } from "next/navigation";
import { MarketingAssessmentCards } from "@/components/marketing/MarketingAssessmentCards";
import { MarketingFaq } from "@/components/marketing/MarketingFaq";
import { MarketingFinalCta } from "@/components/marketing/MarketingFinalCta";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingHero } from "@/components/marketing/MarketingHero";
import { MarketingProblems } from "@/components/marketing/MarketingProblems";
import { MarketingStats } from "@/components/marketing/MarketingStats";
import { MarketingWorks } from "@/components/marketing/MarketingWorks";

export function MarketingHome() {
  const router = useRouter();

  return (
    <>
      <MarketingHeader />
      <main>
        <MarketingHero />
        <MarketingStats />
        <MarketingProblems />
        <MarketingWorks />
        <MarketingAssessmentCards onBookDeepDive={() => router.push("/deep-dive")} />
        <MarketingFaq />
        <MarketingFinalCta />
      </main>
      <MarketingFooter />
    </>
  );
}
