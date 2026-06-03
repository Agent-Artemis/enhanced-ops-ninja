/**
 * Completes a paid deep-dive assessment row and emails the participant.
 * DB schema for `deep_dive_assessments` (columns below) must exist in Supabase; no migration for this table ships in this repo yet.
 */
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  assessmentId: z.string().uuid(),
  answers: z.unknown(),
  overallScore: z.number().finite(),
  moduleScores: z.union([z.record(z.unknown()), z.array(z.unknown())]),
  email: z.string().trim().email().max(320),
  firstName: z.string().trim().min(1).max(120),
});

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

/** Escape a URL for use inside double-quoted HTML attributes. */
function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/'/g, "&#39;");
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}

function formatAssessmentScore(score: number): string {
  if (!Number.isFinite(score)) return "0";
  const rounded = Math.round(score);
  if (!Number.isSafeInteger(rounded)) return "0";
  return String(rounded);
}

function buildCompletionEmailHtml(params: {
  firstName: string;
  overallScore: number;
  calBookingUrl: string;
  portalLink: string;
}): string {
  const safeName = escapeHtmlMinimal(params.firstName);
  const score = formatAssessmentScore(params.overallScore);
  const calHref = escapeHtmlAttr(params.calBookingUrl);
  const portalHref = escapeHtmlAttr(params.portalLink);
  return `<!DOCTYPE html>
<html lang="en">
  <head><meta charset="utf-8" /></head>
  <body style="margin:0;padding:24px;font-family:ui-sans-serif,system-ui,sans-serif;font-size:16px;line-height:1.6;color:#0f172a;background:#f8fafc;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px 24px;border:1px solid #e2e8f0;">
      <tr><td>
        <p style="margin:0 0 16px;">Hi ${safeName},</p>
        <p style="margin:0 0 16px;">Your Enhanced Ops deep dive is complete. Here is how you scored overall:</p>
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 20px;width:100%;border-collapse:separate;border-spacing:0;">
          <tr>
            <td style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;padding:16px 18px;text-align:center;">
              <div style="font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#64748b;margin:0 0 6px;">Overall score</div>
              <div style="font-size:32px;font-weight:800;color:#0f172a;line-height:1.1;margin:0;">${score}<span style="font-size:18px;font-weight:600;color:#64748b;"> / 100</span></div>
            </td>
          </tr>
        </table>
        <p style="margin:0 0 16px;">Our ninjas will review your answers and map what a focused implementation plan could look like for your team. On a short call we will walk through the highlights, answer questions, and outline practical next steps.</p>
        <p style="margin:0 0 12px;">
          <a href="${calHref}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">Schedule My Review Call →</a>
        </p>
        <p style="margin:0 0 24px;">
          <a href="${portalHref}" style="display:inline-block;background:#1A6ECC;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">Access Your Secret Mission Portal →</a>
        </p>
        <p style="margin:0 0 4px;color:#64748b;font-size:13px;">Your mission portal is where you will track your implementation progress, view your briefing, and see your results. The link above logs you in automatically — bookmark the portal after you land.</p>
        <p style="margin:0 0 20px;color:#94a3b8;font-size:12px;">This login link expires in 24 hours. You can always request a new one at <a href="https://mission.enhancedops.ninja" style="color:#1A6ECC;">mission.enhancedops.ninja</a>.</p>
        <p style="margin:0 0 12px;color:#64748b;font-size:14px;line-height:1.5;">If you choose to move forward with implementation, dollars you have already invested in this assessment apply toward that engagement.</p>
        <p style="margin:0;color:#64748b;font-size:14px;">Jeff Oldroyd<br />Enhanced Ops Ninja</p>
      </td></tr>
    </table>
  </body>
</html>`;
}

// The correct Cal.com event slug — verified 200 OK.
// "45-min-with-enhanced-ops-ninja" returns 404; the working slug is "45-min".
const DEFAULT_CAL_BOOKING_URL = "https://cal.com/enhancedopsninja/45-min";

export async function POST(req: Request) {
  const cfg = checkRequiredEnv();
  if (!cfg.ok) {
    return NextResponse.json({ error: cfg.message }, { status: 503 });
  }

  const json: unknown = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { assessmentId, answers, overallScore, moduleScores, email, firstName } = parsed.data;
  const completedAt = new Date().toISOString();
  const calBookingUrl = process.env.CAL_COM_BOOKING_URL?.trim() || DEFAULT_CAL_BOOKING_URL;

  const admin = getSupabaseAdmin();

  try {
    const { data: updatedRows, error: updateError } = await admin
      .from("deep_dive_assessments")
      .update({
        assessment_answers: answers,
        assessment_score: overallScore,
        module_scores: moduleScores,
        assessment_completed_at: completedAt,
      })
      .eq("id", assessmentId)
      .select("id");

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    if (!updatedRows?.length) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    // Generate a one-time magic link to the client portal.
    // Try 'invite' first (creates user if new), fall back to 'magiclink' for
    // existing users. Either way the client clicks once and is logged in.
    const PORTAL_URL = "https://mission.enhancedops.ninja";
    let portalLink = PORTAL_URL;
    try {
      const { data: linkData } = await admin.auth.admin.generateLink({
        type: "invite",
        email,
        options: { redirectTo: PORTAL_URL },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const actionLink = (linkData as any)?.properties?.action_link as string | undefined;
      if (actionLink) portalLink = actionLink;
    } catch {
      try {
        const { data: mlData } = await admin.auth.admin.generateLink({
          type: "magiclink",
          email,
          options: { redirectTo: PORTAL_URL },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const actionLink = (mlData as any)?.properties?.action_link as string | undefined;
        if (actionLink) portalLink = actionLink;
      } catch {
        // Fall back to plain portal URL — client can request magic link themselves
      }
    }

    const resend = new Resend(cfg.resendKey);
    const html = buildCompletionEmailHtml({ firstName, overallScore, calBookingUrl, portalLink });

    const { error: sendError } = await resend.emails.send({
      from: "jeff@enhancedops.ninja",
      to: email,
      subject: "Your EnhancedOps Assessment Results Are In",
      html,
    });

    if (sendError) {
      return NextResponse.json(
        { error: sendError.message ?? "Failed to send confirmation email" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, assessmentCompletedAt: completedAt });
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
