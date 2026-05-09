"use client";

import { useCallback, useState } from "react";

import { AssessmentModal } from "@/components/marketing/AssessmentModal";
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
  window.alert("Stripe Checkout for the $2,500 in-depth assessment will open from this button.");
}

export function MarketingHome() {
  const [assessmentOpen, setAssessmentOpen] = useState(false);

  const openAssessment = useCallback(() => setAssessmentOpen(true), []);
  const closeAssessment = useCallback(() => setAssessmentOpen(false), []);

  return (
    <>
      <MarketingHeader onOpenAssessment={openAssessment} onBookCall={placeholderCalendly} />
      <main>
        <MarketingHero onOpenAssessment={openAssessment} onBookCall={placeholderCalendly} />
        <MarketingStats />
        <MarketingProblems />
        <MarketingWorks />
        <MarketingServices />
        <MarketingAssessmentCards
          onOpenAssessment={openAssessment}
          onBookDeepDive={placeholderStripe}
        />
        <MarketingFaq />
        <MarketingFinalCta onOpenAssessment={openAssessment} onBookCall={placeholderCalendly} />
      </main>
      <MarketingFooter />
      <AssessmentModal open={assessmentOpen} onClose={closeAssessment} />
    </>
  );
}
