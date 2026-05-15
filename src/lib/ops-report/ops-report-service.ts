import type { SupabaseClient } from "@supabase/supabase-js";

import { buildReportData } from "@/lib/ops-report/report-builder";
import { generateReportHTML } from "@/lib/ops-report/report-template";
import { renderPdfWithBrowserless } from "@/lib/ops-report/pdf-render";
import { MODULE_CONFIG } from "@/lib/ops-report/scoring";

export type PdfGenerationResult =
  | { ok: true; pdfUrl: string; bytes: null }
  | { ok: true; pdfUrl: null; bytes: Buffer }
  | { ok: false; error: string };

export async function generateOpsReportPdf(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<PdfGenerationResult> {
  try {
    const report = await buildReportData(supabase, sessionId);
    const html = generateReportHTML(report);
    const pdfBuffer = await renderPdfWithBrowserless(html);

    const bucket = process.env.OPS_REPORTS_BUCKET ?? "assessment-reports";
    const objectPath = `ops/${sessionId}.pdf`;

    const upload = await supabase.storage.from(bucket).upload(objectPath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

    if (!upload.error) {
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(objectPath);
      return { ok: true, pdfUrl: pub.publicUrl, bytes: null };
    }

    return { ok: true, pdfUrl: null, bytes: pdfBuffer };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
}

export async function persistModuleScoresAndReportSummary(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<void> {
  const report = await buildReportData(supabase, sessionId);

  const { data: answers } = await supabase
    .from("ops_assessment_answers")
    .select("module_number,answer_points")
    .eq("session_id", sessionId);

  const rows = report.modules.map((m) => {
    const cfg = MODULE_CONFIG.find((c) => c.number === m.module_number);
    const weight = cfg?.weight ?? 0;
    const modAnswers = (answers ?? []).filter((a) => a.module_number === m.module_number);
    const raw = modAnswers.reduce((s, a) => s + (Number(a.answer_points) || 0), 0);
    const maxQ = cfg?.maxQuestions ?? 0;
    return {
      session_id: sessionId,
      module_number: m.module_number,
      module_name: m.module_name,
      questions_answered: modAnswers.length,
      raw_points_earned: raw,
      max_possible_points: maxQ * 4,
      module_score_pct: Number(m.module_score_pct.toFixed(2)),
      module_weight: Number(weight.toFixed(3)),
      weighted_score: Number((m.module_score_pct * weight).toFixed(2)),
      status_color: m.status_color,
      dollar_loss_calculated: m.dollar_loss_calculated,
      dollar_loss_label: m.dollar_loss_label,
      recommended_offer: m.recommended_offer,
      recommended_offer_desc: m.recommended_offer_description,
      deployment_timeline: m.deployment_timeline,
      expected_impact: m.expected_impact,
    };
  });

  await supabase.from("ops_module_scores").delete().eq("session_id", sessionId);
  const insScores = await supabase.from("ops_module_scores").insert(rows);
  if (insScores.error) {
    throw new Error(insScores.error.message);
  }

  const reportPayload = {
    session_id: sessionId,
    overall_score: Number(report.overall_score.toFixed(2)),
    overall_status: report.overall_status,
    total_dollar_loss: report.total_dollar_loss,
    total_dollar_loss_label: report.total_dollar_loss_label,
    priority_1_module: report.priority_1_module,
    priority_1_finding: report.priority_1_finding,
    priority_2_module: report.priority_2_module,
    priority_2_finding: report.priority_2_finding,
    priority_3_module: report.priority_3_module,
    priority_3_finding: report.priority_3_finding,
    phase_1_recommendations: report.phase_1_recommendations,
    phase_2_recommendations: report.phase_2_recommendations,
    phase_3_recommendations: report.phase_3_recommendations,
    full_report_json: report,
    pdf_generated: false,
  };

  const upsertReport = await supabase.from("ops_assessment_reports").upsert(reportPayload, { onConflict: "session_id" });
  if (upsertReport.error) {
    throw new Error(upsertReport.error.message);
  }
}
