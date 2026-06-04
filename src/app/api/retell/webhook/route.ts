/**
 * Retell IVR webhook handler.
 *
 * Retell POSTs call lifecycle events here: call_started, call_ended, call_analyzed.
 * We only persist on call_ended and call_analyzed (never on call_started, which
 * produces a partial record). Upsert on call_id handles replayed events safely.
 *
 * HMAC verification: Retell sends x-retell-signature = HMAC-SHA256(rawBody, RETELL_API_KEY).
 */
import crypto from "node:crypto";
import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Events we persist to the database.
const PERSIST_EVENTS = new Set(["call_ended", "call_analyzed"]);

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}

/**
 * Verify the HMAC-SHA256 signature sent by Retell.
 * Returns true if the signature matches, false otherwise.
 */
function verifyRetellSignature(rawBody: string, signature: string, apiKey: string): boolean {
  const expected = crypto
    .createHmac("sha256", apiKey)
    .update(rawBody, "utf8")
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const retellApiKey = process.env.RETELL_API_KEY;
  if (!retellApiKey) {
    return NextResponse.json({ error: "RETELL_API_KEY not configured" }, { status: 503 });
  }

  // Read raw body for HMAC verification (must happen before any parsing).
  const rawBody = await req.text().catch(() => null);
  if (rawBody === null) {
    return NextResponse.json({ error: "Failed to read request body" }, { status: 400 });
  }

  // Verify signature.
  const signature = req.headers.get("x-retell-signature") ?? "";
  if (!signature) {
    return NextResponse.json({ error: "Missing x-retell-signature header" }, { status: 401 });
  }
  if (!verifyRetellSignature(rawBody, signature, retellApiKey)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Parse payload.
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return NextResponse.json({ error: "Unexpected payload shape" }, { status: 400 });
  }

  const body = payload as Record<string, unknown>;
  const event = typeof body.event === "string" ? body.event : "";

  // Acknowledge events we don't persist (call_started, unknown future events).
  if (!PERSIST_EVENTS.has(event)) {
    return NextResponse.json({ ok: true, event, persisted: false });
  }

  const call = typeof body.call === "object" && body.call !== null
    ? (body.call as Record<string, unknown>)
    : null;

  if (!call) {
    return NextResponse.json({ error: "Missing call object in payload" }, { status: 400 });
  }

  const callId = typeof call.call_id === "string" ? call.call_id : null;
  if (!callId) {
    return NextResponse.json({ error: "Missing call.call_id" }, { status: 400 });
  }

  const analysis =
    typeof call.call_analysis === "object" && call.call_analysis !== null
      ? (call.call_analysis as Record<string, unknown>)
      : null;

  const record = {
    call_id: callId,
    agent_id: typeof call.agent_id === "string" ? call.agent_id : null,
    from_number: typeof call.from_number === "string" ? call.from_number : null,
    to_number: typeof call.to_number === "string" ? call.to_number : null,
    call_status: typeof call.call_status === "string" ? call.call_status : null,
    duration_ms: typeof call.duration_ms === "number" ? call.duration_ms : null,
    recording_url: typeof call.recording_url === "string" ? call.recording_url : null,
    transcript: typeof call.transcript === "string" ? call.transcript : null,
    call_reason: analysis && typeof analysis.call_reason === "string" ? analysis.call_reason : null,
    patient_name: analysis && typeof analysis.patient_name === "string" ? analysis.patient_name : null,
    call_disposition:
      analysis && typeof analysis.call_disposition === "string" ? analysis.call_disposition : null,
    follow_up_required:
      analysis && typeof analysis.follow_up_required === "boolean"
        ? analysis.follow_up_required
        : false,
    follow_up_notes:
      analysis && typeof analysis.follow_up_notes === "string" ? analysis.follow_up_notes : null,
    raw_payload: body,
  };

  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from("retell_calls")
      .upsert(record, { onConflict: "call_id" });

    if (error) {
      console.error("[retell/webhook] Supabase upsert error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, event, call_id: callId, persisted: true });
  } catch (err: unknown) {
    console.error("[retell/webhook] Unexpected error:", errorMessage(err));
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
