import { NextResponse } from "next/server";
import { z } from "zod";

import { assessmentConfigFilename, loadAssessmentConfig } from "@/lib/assessments/load";
import { toPublicAssessmentPayload } from "@/lib/assessment/public-config";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  track: z.enum(["healthcare", "business"]),
  tier: z.enum(["free", "paid"]).default("free"),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    track: url.searchParams.get("track") ?? undefined,
    tier: url.searchParams.get("tier") ?? "free",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const filename = assessmentConfigFilename(parsed.data.tier, parsed.data.track);
  const config = await loadAssessmentConfig(filename);
  return NextResponse.json({ config: toPublicAssessmentPayload(config) });
}
