/**
 * Vercel Cron — runs every hour.
 * Picks up pending nurture_queue rows whose scheduled_at <= now(),
 * sends via Resend, and marks them sent.
 */
import { NextResponse } from "next/server";
import { Resend } from "resend";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { buildNurtureEmail, type NurtureStep } from "@/lib/email/nurture-templates";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FROM = "jeff@enhancedops.ninja";
const BATCH = 50;

export async function GET(req: Request) {
  // Vercel cron passes Authorization: Bearer $CRON_SECRET
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not set" }, { status: 503 });
  }

  const admin = getSupabaseAdmin();
  const resend = new Resend(resendKey);

  // Fetch due rows
  const { data: rows, error: fetchError } = await admin
    .from("nurture_queue")
    .select("id, email, first_name, step, session_id")
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(BATCH);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!rows?.length) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  // Fetch scores for step-0 emails (results email needs the score)
  const step0Ids = rows
    .filter((r) => r.step === 0 && r.session_id)
    .map((r) => r.session_id as string);

  const scoreMap = new Map<string, number>();
  if (step0Ids.length) {
    const { data: scores } = await admin
      .from("assessment_scores")
      .select("session_id, overall_score")
      .in("session_id", step0Ids);
    for (const s of scores ?? []) {
      if (s.session_id) scoreMap.set(s.session_id, s.overall_score ?? 0);
    }
  }

  let sent = 0;
  const failed: string[] = [];

  for (const row of rows) {
    try {
      const overallScore = row.session_id ? (scoreMap.get(row.session_id) ?? 0) : 0;
      const { subject, html } = buildNurtureEmail(row.step as NurtureStep, {
        firstName: row.first_name || "there",
        overallScore,
      });

      const { error: sendError } = await resend.emails.send({
        from: FROM,
        to: row.email,
        subject,
        html,
      });

      if (sendError) {
        console.error(`[cron/nurture] send failed for ${row.email} step ${row.step}:`, sendError.message);
        failed.push(row.id);
        continue;
      }

      await admin
        .from("nurture_queue")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", row.id);

      sent++;
    } catch (err) {
      console.error(`[cron/nurture] unexpected error for row ${row.id}:`, err);
      failed.push(row.id);
    }
  }

  return NextResponse.json({ ok: true, sent, failed: failed.length });
}
