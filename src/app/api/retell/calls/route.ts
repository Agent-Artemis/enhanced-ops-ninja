/**
 * Internal dashboard: recent Retell call log.
 *
 * Returns the 50 most recent calls ordered by created_at DESC.
 * Server-side only — uses the Supabase service role key which must never
 * be exposed to the client.
 *
 * No public auth is applied here; protect this route at the network/middleware
 * layer or add an Authorization header check if exposed externally.
 */
import { NextResponse } from "next/server";

import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 },
    );
  }

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("retell_calls")
      .select(
        "id, call_id, agent_id, from_number, to_number, call_status, call_reason, patient_name, call_disposition, follow_up_required, follow_up_notes, duration_ms, recording_url, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[retell/calls] Supabase query error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ calls: data ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[retell/calls] Unexpected error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
