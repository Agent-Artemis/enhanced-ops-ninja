/**
 * Cal.com (or compatible) booking webhook.
 *
 * Every booking is queued for review in the One Card System: the contact card
 * carries a `custom_fields.pending_booking` entry that the CRM's Bookings panel
 * lists for approve / ignore. Approving files the card on the appointment date.
 * Existing contacts (duplicates) are never moved or modified beyond the pending
 * entry + a note. If the attendee also has a `deep_dive_assessments` row, that
 * row is updated and a confirmation email is sent (assessment funnel only —
 * DM/link bookings rely on Cal.com's own confirmation email).
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
    payload: z.record(z.unknown()).optional().nullable(),
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

/**
 * YYYY-MM-DD in the business timezone (America/Denver) so the card is filed on
 * the same calendar day the appointment shows on Jeff's Google Calendar.
 */
function toBusinessDateString(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
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
  const lastName = nameStr.split(" ").slice(1).join(" ").trim();
  const startTime = payload?.startTime;

  const appointmentScheduledAt = normalizeAppointmentScheduledAt(startTime);
  const callTimeLabel = formatCallTimeForEmail(startTime);
  const eventTitleRaw = payload?.title ?? payload?.eventTitle ?? payload?.type;
  const eventTitle = typeof eventTitleRaw === "string" && eventTitleRaw.trim() ? eventTitleRaw.trim() : "Appointment";

  const admin = getSupabaseAdmin();

  try {
    // ── One Card System: queue the booking for review ─────────────────────
    // The card is NOT filed on a date until approved in the CRM Bookings panel.
    const nextActionDate = toBusinessDateString(appointmentScheduledAt);

    let contactId: string | null = null;
    let duplicate = false;
    const { data: existingContact, error: contactSelectError } = await admin
      .from("crm_contacts")
      .select("id, custom_fields")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();

    if (contactSelectError) {
      return NextResponse.json({ error: contactSelectError.message }, { status: 500 });
    }

    const pendingBooking = {
      event_title: eventTitle,
      start_time: appointmentScheduledAt,
      date: nextActionDate,
      time_label: callTimeLabel,
      duplicate: Boolean(existingContact?.id),
    };

    if (existingContact?.id) {
      duplicate = true;
      const mergedCustomFields = {
        ...(isRecord(existingContact.custom_fields) ? existingContact.custom_fields : {}),
        pending_booking: pendingBooking,
      };
      const { error: contactUpdateError } = await admin
        .from("crm_contacts")
        .update({ custom_fields: mergedCustomFields })
        .eq("id", existingContact.id);
      if (contactUpdateError) {
        return NextResponse.json({ error: contactUpdateError.message }, { status: 500 });
      }
      contactId = existingContact.id;
    } else {
      // New contacts start inactive in A-Z so they don't clutter Action Needed
      // or date slots before Jeff approves the booking.
      const { data: createdContact, error: contactInsertError } = await admin
        .from("crm_contacts")
        .insert({
          first_name: firstName || email,
          last_name: lastName || null,
          email,
          is_active: false,
          bucket: "alpha",
          next_action_date: null,
          tags: ["cal-booking"],
          custom_fields: { pending_booking: pendingBooking },
        })
        .select("id")
        .single();
      if (contactInsertError) {
        return NextResponse.json({ error: contactInsertError.message }, { status: 500 });
      }
      contactId = createdContact?.id ?? null;
    }

    if (contactId) {
      await admin.from("crm_notes").insert({
        contact_id: contactId,
        body: `Booked via Cal.com: ${eventTitle} — ${callTimeLabel}`,
      });
    }

    // ── Assessment funnel (best-effort): update row + send confirmation ───
    let assessmentId: string | null = null;
    const { data: row } = await admin
      .from("deep_dive_assessments")
      .select("id")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (row?.id) {
      assessmentId = row.id;
      const { error: updateError } = await admin
        .from("deep_dive_assessments")
        .update({ appointment_scheduled_at: appointmentScheduledAt })
        .eq("id", row.id);

      if (!updateError) {
        const resend = new Resend(cfg.resendKey);
        const html = buildBookingConfirmedEmailHtml({ firstName: firstName || "there", callTimeLabel });
        await resend.emails.send({
          from: "jeff@enhancedops.ninja",
          to: email,
          subject: "Your 1:1 Review Call Is Confirmed",
          html,
        });
      }
    }

    return NextResponse.json({ ok: true, contactId, duplicate, assessmentId, appointmentScheduledAt });
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
