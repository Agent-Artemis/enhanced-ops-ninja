import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseAdmin } from "@/lib/ops-report/supabase-admin";
import { generateOpsReportPdf } from "@/lib/ops-report/ops-report-service";

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

      return NextResponse.json({ ok: true, pdfUrl: pdf.pdfUrl });
    }

    if (pdf.bytes) {
      const filename = `ops-report-${session_id}.pdf`;
      return new NextResponse(new Uint8Array(pdf.bytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({ error: "PDF generation returned no bytes" }, { status: 500 });
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
