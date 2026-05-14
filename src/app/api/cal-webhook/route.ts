/**
 * Cal.com (or compatible) booking webhook: ties a scheduled call to the latest
 * `deep_dive_assessments` row for the attendee email and sends a confirmation email.
 *
 * Cal payload shapes vary by product version and event type; this handler reads a
 * small set of tolerant paths and ignores unknown fields.
 */
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Minimal shape so we can read `payload`; extra keys are allowed. */
const bodySchema = z
  .object({
    payload: z.record(z.unknown()).optional(),
  })
  .passthrough();

type EnvCheck =
  | { ok: true; resendKey: string }
  | { ok: false; message: string };

function checkRequiredEnv(): EnvCheck {
  const resendKey = process.env.RESEND_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!resendKey || !supabaseUrl || !supabaseServiceKey) {
    const missing: string[] = [];
    if (!resendKey) missing.push("RESEND_API_KEY");
    if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!supabaseServiceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
    return {
      ok: false,
      message: `Missing required environment variables: ${missing.join(", ")}`,
    };
  }
  return { ok: true, resendKey };
}

function escapeHtmlMinimal(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function normalizeAppointmentScheduledAt(startTime: unknown): string | null {
  if (startTime instanceof Date) {
    return Number.isNaN(startTime.getTime()) ? null : startTime.toISOString();
  }
  if (typeof startTime === "string") {
    const trimmed = startTime.trim();
    return trimmed || null;
  }
  if (typeof startTime === "number" && Number.isFinite(startTime)) {
    const asDate = new Date(startTime);
    return Number.isNaN(asDate.getTime()) ? null : asDate.toISOString();
  }
  return null;
}

function formatCallTimeForEmail(startTime: unknown): string {
  if (startTime instanceof Date && !Number.isNaN(startTime.getTime())) {
    return startTime.toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" });
  }
  if (typeof startTime === "string" && startTime.trim()) {
    const d = new Date(startTime);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" });
    }
    return startTime.trim();
  }
  if (typeof startTime === "number" && Number.isFinite(startTime)) {
    const d = new Date(startTime);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" });
    }
  }
  return "the scheduled time";
}

function buildBookingConfirmedEmailHtml(params: { firstName: string; callTimeLabel: string }): string {
  const safeName = escapeHtmlMinimal(params.firstName);
  const safeTime = escapeHtmlMinimal(params.callTimeLabel);
  return `<!DOCTYPE html>
<html lang="en">
  <head><meta charset="utf-8" /></head>
  <body style="margin:0;padding:24px;font-family:ui-sans-serif,system-ui,sans-serif;font-size:16px;line-height:1.6;color:#0f172a;background:#f8fafc;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px 24px;border:1px solid #e2e8f0;">
      <tr><td>
        <p style="margin:0 0 16px;">Hi ${safeName},</p>
        <p style="margin:0 0 16px;">Your 1:1 review call with Enhanced Ops Ninja is confirmed.</p>
        <p style="margin:0 0 16px;"><strong>When:</strong> ${safeTime}</p>
        <p style="margin:0 0 16px;">We will use this time to walk through your assessment highlights, answer questions, and discuss practical next steps for your team.</p>
        <p style="margin:0;color:#64748b;font-size:14px;">Jeff Oldroyd<br />Enhanced Ops Ninja</p>
      </td></tr>
    </table>
  </body>
</html>`;
}

export async function POST(req: Request) {
  const cfg = checkRequiredEnv();
  if (!cfg.ok) {
    return NextResponse.json({ error: cfg.message }, { status: 503 });
  }

  const json: unknown = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const body = parsed.data as Record<string, unknown>;
  const payload = isRecord(body.payload) ? body.payload : undefined;
  const attendeesRaw = payload?.attendees;
  const attendees = Array.isArray(attendeesRaw) ? attendeesRaw : [];
  const attendee0 = attendees[0];
  const attendee = isRecord(attendee0) ? attendee0 : undefined;

  const emailRaw = attendee?.email;
  const email = typeof emailRaw === "string" ? emailRaw.trim() : "";
  if (!email) {
    return NextResponse.json(
      { error: "Missing attendee email in webhook payload (expected payload.attendees[0].email)" },
      { status: 400 },
    );
  }

  const nameRaw = attendee?.name;
  const nameStr = typeof nameRaw === "string" ? nameRaw : "";
  const firstName = nameStr.split(" ")[0]?.trim() ?? "";
  const startTime = payload?.startTime;

  const appointmentScheduledAt = normalizeAppointmentScheduledAt(startTime);

  const admin = getSupabaseAdmin();

  try {
    const { data: row, error: selectError } = await admin
      .from("deep_dive_assessments")
      .select("id")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (selectError) {
      return NextResponse.json({ error: selectError.message }, { status: 500 });
    }
    if (!row?.id) {
      return NextResponse.json({ error: "No matching assessment" }, { status: 404 });
    }

    const { error: updateError } = await admin
      .from("deep_dive_assessments")
      .update({ appointment_scheduled_at: appointmentScheduledAt })
      .eq("id", row.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const resend = new Resend(cfg.resendKey);
    const callTimeLabel = formatCallTimeForEmail(startTime);
    const html = buildBookingConfirmedEmailHtml({ firstName: firstName || "there", callTimeLabel });

    const { error: sendError } = await resend.emails.send({
      from: "jeff@enhancedops.ninja",
      to: email,
      subject: "Your 1:1 Review Call Is Confirmed",
      html,
    });

    if (sendError) {
      return NextResponse.json(
        { error: sendError.message ?? "Failed to send confirmation email" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, assessmentId: row.id, appointmentScheduledAt });
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
