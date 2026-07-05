/**
 * Completes a paid deep-dive assessment row and emails the participant.
 * DB schema for `deep_dive_assessments` (columns below) must exist in Supabase; no migration for this table ships in this repo yet.
 */
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getDeepDiveModuleTitleForScoreKey } from "@/lib/deep-dive/assessment-data";
import type { BusinessTrack } from "@/lib/deep-dive/pricing";

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

// Assessment checkouts book the 60-min Secret Mission Briefing (hidden event —
// reachable only via this link, not listed on the public Cal.com page).
const DEFAULT_CAL_BOOKING_URL = "https://cal.com/enhancedopsninja/secret-mission-briefing";

/**
 * Rough worksheet values derived from the client's ranged multiple-choice
 * answers (midpoints). Approximate starting points the coach refines on the
 * call — NOT precise figures. Healthcare track today; business track uses
 * different question ids and can be added later.
 */
function deriveWorksheetEstimates(
  answers: Record<string, string>,
  track: string,
): Record<string, number> {
  if (track !== "healthcare") return {};
  const out: Record<string, number> = {};
  // hc_p_08 — FTE count → staff_count
  const fte: Record<string, number> = { A: 5, B: 20, C: 53, D: 90 };
  if (answers.hc_p_08 in fte) out.staff_count = fte[answers.hc_p_08];
  // hc_p_01 — annual revenue → estimated_monthly_revenue (annual midpoint / 12)
  const rev: Record<string, number> = { A: 42000, B: 250000, C: 1250000, D: 2500000 };
  if (answers.hc_p_01 in rev) out.estimated_monthly_revenue = rev[answers.hc_p_01];
  // hc_p_09 — turnover → turnover_rate_percent
  const turn: Record<string, number> = { A: 10, B: 20, C: 32, D: 50 };
  if (answers.hc_p_09 in turn) out.turnover_rate_percent = turn[answers.hc_p_09];
  return out;
}

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
      .select("id, last_name, phone, org_name, business_type");

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    if (!updatedRows?.length) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    // ── One Card System: every completed assessment becomes a dojo card ────
    // Lands in "Action Needed" (active, no date) with the scores attached.
    // Best-effort — a card failure must never block the completion email.
    try {
      const row = updatedRows[0] as {
        id: string; last_name?: string | null; phone?: string | null;
        org_name?: string | null; business_type?: string | null;
      };
      const assessmentInfo = {
        assessment_id: assessmentId,
        overall_score: overallScore,
        module_scores: moduleScores,
        business_type: row.business_type ?? null,
        completed_at: completedAt,
      };
      const moduleLines = Object.entries(moduleScores ?? {})
        .map(([m, s]) => `${m}: ${s}%`)
        .join(" · ");

      const { data: existingCard } = await admin
        .from("crm_contacts")
        .select("id, custom_fields")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();

      let cardId = existingCard?.id ?? null;
      if (cardId) {
        const merged = {
          ...(existingCard?.custom_fields && typeof existingCard.custom_fields === "object"
            ? existingCard.custom_fields as Record<string, unknown> : {}),
          assessment: assessmentInfo,
        };
        await admin
          .from("crm_contacts")
          .update({
            company: row.org_name ?? undefined,
            phone: row.phone ?? undefined,
            is_active: true,
            custom_fields: merged,
          })
          .eq("id", cardId);
      } else {
        const { data: created } = await admin
          .from("crm_contacts")
          .insert({
            first_name: firstName || email,
            last_name: row.last_name ?? null,
            company: row.org_name ?? null,
            phone: row.phone ?? null,
            email,
            is_active: true,
            bucket: "active",
            next_action_date: null,
            tags: ["deep-dive"],
            custom_fields: { assessment: assessmentInfo },
          })
          .select("id")
          .single();
        cardId = created?.id ?? null;
      }

      if (cardId) {
        await admin.from("crm_notes").insert({
          contact_id: cardId,
          body: `Deep-Dive Assessment completed — Overall ${overallScore}%${moduleLines ? ` — ${moduleLines}` : ""}`,
        });
      }
    } catch {
      // swallow — email flow continues regardless
    }

    // ── eon-app dojo pipeline: paid completions are not free assessments ───
    // A DB trigger stamps new client rows 'free_assessment_complete'; correct
    // it here since this route only runs for the paid deep-dive. Also write the
    // score summary into the client's notes so the dojo card shows the results
    // (the clients table has no assessment columns of its own).
    try {
      const rowBiz = (updatedRows[0] as { business_type?: string | null }).business_type;
      const track = (rowBiz === "business" ? "business" : "healthcare") as BusinessTrack;
      // Domain names ("Financials & Revenue Health: 100%") instead of "module-1".
      const namedLines = Object.entries(moduleScores ?? {})
        .map(([k, s]) => `${getDeepDiveModuleTitleForScoreKey(k, track)}: ${s}%`);
      const noteText =
        `DEEP-DIVE ASSESSMENT — completed ${completedAt.slice(0, 10)}\n` +
        `Overall: ${overallScore}%\n` +
        namedLines.join("\n");

      const { data: clientForOrg } = await admin
        .from("clients").select("id, name").ilike("primary_contact_email", email).limit(1).maybeSingle();

      await admin
        .from("clients")
        .update({ pipeline_stage: "paid_assessment_complete", notes: noteText })
        .ilike("primary_contact_email", email)
        .eq("pipeline_stage", "free_assessment_complete");

      // Seed the dojo Deep Dive tab (`assessments` table, read by client_id) so
      // the coach starts from the funnel result instead of a blank worksheet.
      if (clientForOrg?.id) {
        const { data: existingAssessment } = await admin
          .from("assessments").select("id").eq("client_id", clientForOrg.id).limit(1).maybeSingle();
        const estimates = deriveWorksheetEstimates(answers, track);
        const estLines = Object.keys(estimates).length
          ? "\nEstimated from answers (approx — verify): " +
            Object.entries(estimates).map(([k, v]) => `${k}=${v}`).join(", ")
          : "";
        const rawNotes =
          `FUNNEL DEEP-DIVE RESULT (auto-imported)\n` +
          `Org: ${clientForOrg.name ?? "—"} | Type: ${track}\n` +
          `Overall score: ${overallScore}%\n` +
          namedLines.join("\n") + "\n" +
          `Completed: ${completedAt.slice(0, 10)}` + estLines;
        if (existingAssessment?.id) {
          // Never overwrite coach-entered numbers — only refresh notes.
          await admin.from("assessments").update({ raw_notes: rawNotes }).eq("id", existingAssessment.id);
        } else {
          // New row: seed the derived estimates alongside the notes.
          await admin.from("assessments").insert([
            { client_id: clientForOrg.id, status: "draft", raw_notes: rawNotes, ...estimates },
          ]);
        }
      }
    } catch {
      // best-effort — never block completion
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

    // Email is best-effort: the assessment is saved and the card exists, so a
    // mail-provider outage must not fail the client's completion.
    return NextResponse.json({
      ok: true,
      assessmentCompletedAt: completedAt,
      emailSent: !sendError,
      ...(sendError ? { emailError: sendError.message ?? "send failed" } : {}),
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
