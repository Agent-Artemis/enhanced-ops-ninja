import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseAdmin } from "@/lib/ops-report/supabase-admin";
import { generateOpsReportPdf, persistModuleScoresAndReportSummary } from "@/lib/ops-report/ops-report-service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  session_id: z.string().uuid(),
});

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}

export async function POST(req: Request) {
  const json: unknown = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { session_id } = parsed.data;

  try {
    const supabase = createSupabaseAdmin();

    const { count, error: countError } = await supabase
      .from("ops_assessment_answers")
      .select("id", { count: "exact", head: true })
      .eq("session_id", session_id);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    if ((count ?? 0) < 52) {
      return NextResponse.json({ error: "All 52 questions must be answered before completion" }, { status: 400 });
    }

    const { data: session, error: sessionError } = await supabase
      .from("ops_assessment_sessions")
      .select("id,status,stripe_status")
      .eq("id", session_id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.stripe_status !== "paid") {
      return NextResponse.json({ error: "Payment required" }, { status: 402 });
    }

    if (session.status === "completed") {
      return NextResponse.json({ ok: true, alreadyCompleted: true });
    }

    const completedAt = new Date().toISOString();
    const { error: sessionUpdateError } = await supabase
      .from("ops_assessment_sessions")
      .update({
        status: "completed",
        completed_at: completedAt,
      })
      .eq("id", session_id);

    if (sessionUpdateError) {
      return NextResponse.json({ error: sessionUpdateError.message }, { status: 500 });
    }

    await persistModuleScoresAndReportSummary(supabase, session_id);

    const pdf = await generateOpsReportPdf(supabase, session_id);
    if (!pdf.ok) {
      return NextResponse.json({ error: pdf.error }, { status: 500 });
    }

    if (pdf.pdfUrl) {
      const { error: reportErr } = await supabase
        .from("ops_assessment_reports")
        .update({ pdf_url: pdf.pdfUrl, pdf_generated: true })
        .eq("session_id", session_id);
      if (reportErr) {
        return NextResponse.json({ error: reportErr.message }, { status: 500 });
      }

      const { error: sessErr } = await supabase
        .from("ops_assessment_sessions")
        .update({
          report_generated: true,
          report_url: pdf.pdfUrl,
          report_generated_at: new Date().toISOString(),
        })
        .eq("id", session_id);
      if (sessErr) {
        return NextResponse.json({ error: sessErr.message }, { status: 500 });
      }
    } else if (pdf.bytes) {
      return NextResponse.json(
        {
          ok: true,
          warning:
            "PDF rendered but storage upload failed or bucket is not configured. Use POST /api/ops-report/generate-pdf to download bytes.",
        },
        { status: 200 },
      );
    }

    return NextResponse.json({
      ok: true,
      pdfUrl: pdf.pdfUrl,
      pdfBytesReturned: false,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
