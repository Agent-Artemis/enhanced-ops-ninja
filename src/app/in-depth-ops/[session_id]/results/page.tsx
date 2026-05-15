import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseAdmin } from "@/lib/ops-report/supabase-admin";
import { getStatusColor, getStatusEmoji, getStatusLabel } from "@/lib/ops-report/scoring";

export const dynamic = "force-dynamic";

const DEFAULT_CAL = "https://cal.com/enhancedopsninja/45-min-with-enhanced-ops-ninja";

export default async function InDepthResultsPage({
  params,
}: {
  params: Promise<{ session_id: string }>;
}) {
  const { session_id } = await params;
  const supabase = createSupabaseAdmin();
  const calUrl = process.env.CAL_BOOKING_URL?.trim() || DEFAULT_CAL;

  const { data: session, error } = await supabase
    .from("ops_assessment_sessions")
    .select("id,client_name,organization_name,status,stripe_status,report_url")
    .eq("id", session_id)
    .single();

  if (error || !session) {
    redirect("/in-depth-ops");
  }

  if (session.stripe_status !== "paid") {
    redirect(`/in-depth-ops/${session_id}`);
  }

  const { data: report } = await supabase
    .from("ops_assessment_reports")
    .select("overall_score,overall_status,total_dollar_loss_label,pdf_url")
    .eq("session_id", session_id)
    .maybeSingle();

  if (session.status !== "completed" || !report) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-16 text-slate-100">
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-800 bg-slate-900/50 p-8">
          <h1 className="text-2xl font-semibold text-white">Results not ready</h1>
          <p className="mt-3 text-slate-300">Finish all 52 questions and submit to generate your teaser score and PDF.</p>
          <Link className="mt-6 inline-block text-emerald-300 underline" href={`/in-depth-ops/${session_id}`}>
            Continue assessment
          </Link>
        </div>
      </main>
    );
  }

  const overallScore = Number(report.overall_score ?? 0);
  const status = (report.overall_status ?? "YELLOW") as "RED" | "YELLOW" | "GREEN";
  const color = getStatusColor(status);
  const label = getStatusLabel(status);
  const emoji = getStatusEmoji(status);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-14 text-slate-100">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-800 bg-slate-900/40 p-10 shadow-2xl">
        <p className="text-xs uppercase tracking-[0.25em] text-emerald-300/90">Assessment complete</p>
        <h1 className="mt-3 text-4xl font-semibold text-white">Your operations snapshot</h1>
        <p className="mt-3 text-slate-300">
          {session.organization_name ?? session.client_name} — weighted health score across eight modules.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
            <div className="text-sm text-slate-400">Overall score</div>
            <div className="mt-2 text-5xl font-black" style={{ color }}>
              {overallScore.toFixed(1)}
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-200">
              {emoji} {label}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
            <div className="text-sm text-slate-400">Modeled annual exposure</div>
            <div className="mt-2 text-3xl font-bold text-white">{report.total_dollar_loss_label ?? "—"}</div>
            <p className="mt-2 text-sm text-slate-400">
              Full module tables, roadmap, and appendix are in your PDF report{report.pdf_url ? "." : " (generating)."}{" "}
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <a
            href={calUrl}
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-emerald-500 px-4 py-3 text-center text-sm font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Book a review call
          </a>
          {report.pdf_url ? (
            <a
              href={report.pdf_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-700 px-4 py-3 text-center text-sm font-semibold text-white hover:border-emerald-400/60"
            >
              Download PDF
            </a>
          ) : null}
        </div>

        <p className="mt-8 text-sm text-slate-500">
          Need help? Email <span className="text-slate-300">jeff@enhancedops.ninja</span> with your session ID:{" "}
          <code className="text-slate-300">{session_id}</code>
        </p>
      </div>
    </main>
  );
}
