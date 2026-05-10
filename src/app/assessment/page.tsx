import type { Metadata } from "next";

import { AssessmentWizard } from "@/components/assessment/AssessmentWizard";

export const metadata: Metadata = {
  title: "Free Operations Assessment | Enhanced Ops × Ninja",
  description:
    "15-question operational health assessment for healthcare and general business teams.",
};

export default function AssessmentPage() {
  return (
    <div className="min-h-screen bg-eon-black text-white">
      <AssessmentWizard />
    </div>
  );
}
