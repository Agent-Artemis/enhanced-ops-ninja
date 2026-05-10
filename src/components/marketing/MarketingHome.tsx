"use client";

import { MarketingAssessmentCards } from "@/components/marketing/MarketingAssessmentCards";
import { MarketingFaq } from "@/components/marketing/MarketingFaq";
import { MarketingFinalCta } from "@/components/marketing/MarketingFinalCta";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingHero } from "@/components/marketing/MarketingHero";
import { MarketingProblems } from "@/components/marketing/MarketingProblems";
import { MarketingServices } from "@/components/marketing/MarketingServices";
import { MarketingStats } from "@/components/marketing/MarketingStats";
import { MarketingWorks } from "@/components/marketing/MarketingWorks";

function placeholderCalendly() {
  window.alert("[CALENDLY/CAL.COM LINK]");
}

function placeholderStripe() {
  window.alert(
    "Stripe Checkout for the in-depth assessment ($1,500 promotional pricing; list $2,500) will open from this button.",
  );
}

export function MarketingHome() {
  return (
    <>
      <MarketingHeader onBookCall={placeholderCalendly} />
      <main>
        <MarketingHero onBookCall={placeholderCalendly} />
        <MarketingStats />
        <MarketingProblems />
        <MarketingWorks />
        <MarketingServices />
        <MarketingAssessmentCards onBookDeepDive={placeholderStripe} />
        <MarketingFaq />
        <MarketingFinalCta onBookCall={placeholderCalendly} />
      </main>
      <MarketingFooter />
    </>
  );
}
