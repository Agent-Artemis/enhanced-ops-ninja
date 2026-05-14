import { Suspense } from "react";

import { DeepDiveAssessmentWizard } from "@/components/deep-dive/DeepDiveAssessmentWizard";

export default function DeepDiveAssessmentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#000000] px-6 py-16 text-[rgb(255_255_255/0.7)]">
          <p className="mx-auto max-w-lg text-center text-sm">Loading…</p>
        </div>
      }
    >
      <DeepDiveAssessmentWizard />
    </Suspense>
  );
}
